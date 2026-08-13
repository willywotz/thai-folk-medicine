// Package photostore stores photo bytes on the local disk behind the photo.Store
// port. withinlazy: local disk store; swap for S3/MinIO in production.
package photostore

import (
	"context"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

// Local writes photo files under a base directory.
type Local struct {
	dir string
	mu  sync.Mutex
	seq int64
}

// NewLocal builds a local store, creating the directory if needed.
func NewLocal(dir string) (*Local, error) {
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return nil, err
	}
	return &Local{dir: dir}, nil
}

// nextKey builds a collision-safe object key from the time and a sequence.
// withinlazy: time+sequence key; a UUID scheme if multiple instances share a disk.
func (l *Local) nextKey(ext string) string {
	l.mu.Lock()
	l.seq++
	seq := l.seq
	l.mu.Unlock()
	if ext != "" && !strings.HasPrefix(ext, ".") {
		ext = "." + ext
	}
	return fmt.Sprintf("%d-%d%s", time.Now().UnixNano(), seq, ext)
}

// safePath resolves key under the base dir, rejecting traversal.
func (l *Local) safePath(objectKey string) (string, error) {
	clean := filepath.Clean(objectKey)
	if strings.Contains(clean, "..") || filepath.IsAbs(clean) || strings.ContainsRune(clean, filepath.Separator) {
		return "", fmt.Errorf("invalid object key: %q", objectKey)
	}
	return filepath.Join(l.dir, clean), nil
}

// Save writes the reader to a new file and returns its object key.
func (l *Local) Save(_ context.Context, r io.Reader, ext string) (string, error) {
	key := l.nextKey(ext)
	path, err := l.safePath(key)
	if err != nil {
		return "", err
	}
	f, err := os.Create(path)
	if err != nil {
		return "", err
	}
	defer f.Close()
	if _, err := io.Copy(f, r); err != nil {
		return "", err
	}
	return key, nil
}

// Open opens a stored file for reading.
func (l *Local) Open(_ context.Context, objectKey string) (io.ReadCloser, error) {
	path, err := l.safePath(objectKey)
	if err != nil {
		return nil, err
	}
	return os.Open(path)
}

// Delete removes a stored file.
func (l *Local) Delete(_ context.Context, objectKey string) error {
	path, err := l.safePath(objectKey)
	if err != nil {
		return err
	}
	return os.Remove(path)
}
