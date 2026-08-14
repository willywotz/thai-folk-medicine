package httpapi

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/herb"
	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/remedy"
	"github.com/willywotz/thai-folk-medicine/backend/internal/usecase"
)

type stubHerbRepo struct {
	getErr error
}

func (s *stubHerbRepo) Create(_ context.Context, p herb.CreateParams) (herb.Herb, error) {
	return herb.Herb{ID: 1, NameThai: p.NameThai, NameEnglish: p.NameEnglish}, nil
}
func (s *stubHerbRepo) GetByID(_ context.Context, id int64) (herb.Herb, error) {
	if s.getErr != nil {
		return herb.Herb{}, s.getErr
	}
	return herb.Herb{ID: id, NameThai: "ไพล"}, nil
}
func (s *stubHerbRepo) List(context.Context) ([]herb.Herb, error) {
	return []herb.Herb{{ID: 1, NameThai: "ไพล"}}, nil
}
func (s *stubHerbRepo) Update(_ context.Context, p herb.UpdateParams) (herb.Herb, error) {
	return herb.Herb{ID: p.ID, NameThai: p.NameThai}, nil
}
func (s *stubHerbRepo) Delete(context.Context, int64) error { return nil }

type stubHerbRemedyReader struct{}

func (stubHerbRemedyReader) ListByHerb(_ context.Context, herbID int64) ([]remedy.Remedy, error) {
	return []remedy.Remedy{{ID: 1, Name: "ยาต้ม", HealerID: herbID}}, nil
}

func newHerbRouter(repo herb.Repository) *gin.Engine {
	gin.SetMode(gin.TestMode)
	service := usecase.NewHerbService(repo, noopPublisher{})
	return NewRouter(noAuth, NewHerbHandler(service, stubHerbRemedyReader{}))
}

func TestHerbHandler_CreateAndGet(t *testing.T) {
	router := newHerbRouter(&stubHerbRepo{})

	body, _ := json.Marshal(map[string]any{"nameThai": "ไพล", "nameEnglish": "Cassumunar ginger"})
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/v1/herbs", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(rec, req)

	require.Equal(t, http.StatusCreated, rec.Code)
	var created map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &created))
	assert.Equal(t, "ไพล", created["nameThai"])
}

func TestHerbHandler_CreateRejectsEmptyName(t *testing.T) {
	router := newHerbRouter(&stubHerbRepo{})

	body, _ := json.Marshal(map[string]any{"nameThai": ""})
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/v1/herbs", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(rec, req)

	assert.Equal(t, http.StatusBadRequest, rec.Code)
}

func TestHerbHandler_GetNotFound(t *testing.T) {
	router := newHerbRouter(&stubHerbRepo{getErr: herb.ErrNotFound})

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/herbs/1", nil)
	router.ServeHTTP(rec, req)

	assert.Equal(t, http.StatusNotFound, rec.Code)
}

func TestHerbHandler_ListEndpoint(t *testing.T) {
	router := newHerbRouter(&stubHerbRepo{})

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/herbs", nil)
	router.ServeHTTP(rec, req)

	require.Equal(t, http.StatusOK, rec.Code)
	var got []map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &got))
	require.Len(t, got, 1)
	assert.Equal(t, "ไพล", got[0]["nameThai"])
}

func TestHerbHandler_ListRemediesEndpoint(t *testing.T) {
	router := newHerbRouter(&stubHerbRepo{})

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/herbs/1/remedies", nil)
	router.ServeHTTP(rec, req)

	require.Equal(t, http.StatusOK, rec.Code)
	var got []map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &got))
	require.Len(t, got, 1)
	assert.Equal(t, "ยาต้ม", got[0]["name"])
}
