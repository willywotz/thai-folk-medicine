package photostore

import (
	"bytes"
	"context"
	"io"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestSaveOpenDelete(t *testing.T) {
	store, err := NewLocal(t.TempDir())
	require.NoError(t, err)
	ctx := context.Background()

	key, err := store.Save(ctx, bytes.NewBufferString("image-bytes"), ".jpg")
	require.NoError(t, err)
	assert.NotEmpty(t, key)

	rc, err := store.Open(ctx, key)
	require.NoError(t, err)
	data, err := io.ReadAll(rc)
	require.NoError(t, rc.Close())
	require.NoError(t, err)
	assert.Equal(t, "image-bytes", string(data))

	require.NoError(t, store.Delete(ctx, key))
	_, err = store.Open(ctx, key)
	assert.Error(t, err)
}

func TestSaveGeneratesDistinctKeys(t *testing.T) {
	store, err := NewLocal(t.TempDir())
	require.NoError(t, err)
	ctx := context.Background()

	k1, err := store.Save(ctx, bytes.NewBufferString("a"), ".png")
	require.NoError(t, err)
	k2, err := store.Save(ctx, bytes.NewBufferString("b"), ".png")
	require.NoError(t, err)

	assert.NotEqual(t, k1, k2)
}

func TestOpenRejectsPathTraversal(t *testing.T) {
	store, err := NewLocal(t.TempDir())
	require.NoError(t, err)

	_, err = store.Open(context.Background(), "../../etc/passwd")
	assert.Error(t, err)
}
