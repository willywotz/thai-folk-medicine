package httpapi

import (
	"bytes"
	"context"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/photo"
	"github.com/willywotz/thai-folk-medicine/backend/internal/usecase"
)

type stubPhotoRepo struct{ getErr error }

func (s *stubPhotoRepo) Create(_ context.Context, p photo.CreateParams) (photo.Photo, error) {
	return photo.Photo{ID: 1, OwnerType: p.OwnerType, OwnerID: p.OwnerID, ObjectKey: p.ObjectKey}, nil
}
func (s *stubPhotoRepo) GetByID(_ context.Context, id int64) (photo.Photo, error) {
	if s.getErr != nil {
		return photo.Photo{}, s.getErr
	}
	return photo.Photo{ID: id, ObjectKey: "k.jpg", OwnerType: photo.OwnerHealer, OwnerID: 2}, nil
}
func (s *stubPhotoRepo) Delete(context.Context, int64) error { return nil }

type memStore struct{}

func (memStore) Save(_ context.Context, r io.Reader, ext string) (string, error) {
	return "obj" + ext, nil
}
func (memStore) Open(context.Context, string) (io.ReadCloser, error) {
	return io.NopCloser(bytes.NewBufferString("image-bytes")), nil
}
func (memStore) Delete(context.Context, string) error { return nil }

func photoRouter() *gin.Engine {
	gin.SetMode(gin.TestMode)
	service := usecase.NewPhotoService(&stubPhotoRepo{}, memStore{}, noopPub{})
	return NewRouter(noAuth, NewPhotoHandler(service))
}

func multipartUpload(t *testing.T, fields map[string]string, fileField, fileName, content string) (*bytes.Buffer, string) {
	t.Helper()
	body := &bytes.Buffer{}
	w := multipart.NewWriter(body)
	for k, v := range fields {
		require.NoError(t, w.WriteField(k, v))
	}
	if fileField != "" {
		fw, err := w.CreateFormFile(fileField, fileName)
		require.NoError(t, err)
		_, err = io.WriteString(fw, content)
		require.NoError(t, err)
	}
	require.NoError(t, w.Close())
	return body, w.FormDataContentType()
}

func TestUploadPhotoEndpoint(t *testing.T) {
	body, ct := multipartUpload(t, map[string]string{"ownerType": "healer", "ownerId": "2", "caption": "x"}, "file", "p.jpg", "img")
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/v1/photos", body)
	req.Header.Set("Content-Type", ct)
	photoRouter().ServeHTTP(rec, req)

	require.Equal(t, http.StatusCreated, rec.Code)
	assert.Contains(t, rec.Body.String(), "\"ownerType\":\"healer\"")
}

func TestUploadPhotoRejectsBadOwnerType(t *testing.T) {
	body, ct := multipartUpload(t, map[string]string{"ownerType": "district", "ownerId": "2"}, "file", "p.jpg", "img")
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/v1/photos", body)
	req.Header.Set("Content-Type", ct)
	photoRouter().ServeHTTP(rec, req)

	assert.Equal(t, http.StatusBadRequest, rec.Code)
}

func TestUploadPhotoRejectsMissingFile(t *testing.T) {
	body, ct := multipartUpload(t, map[string]string{"ownerType": "healer", "ownerId": "2"}, "", "", "")
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/v1/photos", body)
	req.Header.Set("Content-Type", ct)
	photoRouter().ServeHTTP(rec, req)

	assert.Equal(t, http.StatusBadRequest, rec.Code)
}

func TestUploadPhotoRejectsFileOverMaxSize(t *testing.T) {
	oversized := string(bytes.Repeat([]byte("a"), 10<<20+1))
	body, ct := multipartUpload(t, map[string]string{"ownerType": "healer", "ownerId": "2"}, "file", "p.jpg", oversized)
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/v1/photos", body)
	req.Header.Set("Content-Type", ct)
	photoRouter().ServeHTTP(rec, req)

	assert.Equal(t, http.StatusRequestEntityTooLarge, rec.Code)
}

func TestServePhotoEndpoint(t *testing.T) {
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/photos/1", nil)
	photoRouter().ServeHTTP(rec, req)

	require.Equal(t, http.StatusOK, rec.Code)
	assert.Equal(t, "image-bytes", rec.Body.String())
}
