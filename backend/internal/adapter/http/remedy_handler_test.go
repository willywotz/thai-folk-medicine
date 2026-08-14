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

	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/event"
	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/remedy"
	"github.com/willywotz/thai-folk-medicine/backend/internal/usecase"
)

type stubRemedyRepo struct{ getErr error }

func (s *stubRemedyRepo) Create(_ context.Context, p remedy.CreateParams) (remedy.Remedy, error) {
	herbs := make([]remedy.HerbLink, 0, len(p.Herbs))
	for _, ref := range p.Herbs {
		herbs = append(herbs, remedy.HerbLink{HerbID: ref.HerbID, Amount: ref.Amount})
	}
	return remedy.Remedy{ID: 1, HealerID: p.HealerID, Name: p.Name, Herbs: herbs}, nil
}
func (s *stubRemedyRepo) GetByID(_ context.Context, id int64) (remedy.Remedy, error) {
	if s.getErr != nil {
		return remedy.Remedy{}, s.getErr
	}
	return remedy.Remedy{ID: id, Name: "ยา"}, nil
}
func (s *stubRemedyRepo) ListByHealer(_ context.Context, healerID int64) ([]remedy.Remedy, error) {
	return []remedy.Remedy{{ID: 1, HealerID: healerID, Name: "ยา"}}, nil
}
func (s *stubRemedyRepo) ListByHerb(_ context.Context, herbID int64) ([]remedy.Remedy, error) {
	return []remedy.Remedy{{ID: 1, Name: "ยา"}}, nil
}
func (s *stubRemedyRepo) ListRecent(context.Context, int32) ([]remedy.Remedy, error) {
	return []remedy.Remedy{{ID: 1, Name: "ยา"}}, nil
}
func (s *stubRemedyRepo) Update(_ context.Context, p remedy.UpdateParams) (remedy.Remedy, error) {
	return remedy.Remedy{ID: p.ID, Name: p.Name}, nil
}
func (s *stubRemedyRepo) Delete(context.Context, int64) error { return nil }

type noopPub struct{}

func (noopPub) Publish(context.Context, event.Event) {}

func newRemedyRouter(repo remedy.Repository) *gin.Engine {
	gin.SetMode(gin.TestMode)
	service := usecase.NewRemedyService(repo, noopPub{})
	return NewRouter(noAuth, NewRemedyHandler(service))
}

func TestCreateRemedyEndpoint(t *testing.T) {
	router := newRemedyRouter(&stubRemedyRepo{})
	body, _ := json.Marshal(map[string]any{"healerId": 3, "name": "ยาต้ม", "symptoms": "ไข้"})
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/v1/remedies", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(rec, req)

	require.Equal(t, http.StatusCreated, rec.Code)
	var got map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &got))
	assert.Equal(t, "ยาต้ม", got["name"])
	assert.Equal(t, float64(3), got["healerId"])
}

func TestCreateRemedyRejectsEmptyName(t *testing.T) {
	router := newRemedyRouter(&stubRemedyRepo{})
	body, _ := json.Marshal(map[string]any{"healerId": 3, "name": ""})
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/v1/remedies", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(rec, req)
	assert.Equal(t, http.StatusBadRequest, rec.Code)
}

func TestGetRemedyNotFound(t *testing.T) {
	router := newRemedyRouter(&stubRemedyRepo{getErr: remedy.ErrNotFound})
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/remedies/1", nil)
	router.ServeHTTP(rec, req)
	assert.Equal(t, http.StatusNotFound, rec.Code)
}

func TestCreateRemedyEndpointWithHerbs(t *testing.T) {
	router := newRemedyRouter(&stubRemedyRepo{})
	body, _ := json.Marshal(map[string]any{
		"healerId": 3, "name": "ยาต้ม",
		"herbs": []map[string]any{{"herbId": 1, "amount": "2 กำมือ"}},
	})
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/v1/remedies", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(rec, req)

	require.Equal(t, http.StatusCreated, rec.Code)
	var got map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &got))
	herbs, ok := got["herbs"].([]any)
	require.True(t, ok)
	require.Len(t, herbs, 1)
	herb := herbs[0].(map[string]any)
	assert.Equal(t, float64(1), herb["herbId"])
	assert.Equal(t, "2 กำมือ", herb["amount"])
	assert.NotContains(t, got, "ingredients")
}

func TestListRecentRemedyEndpoint(t *testing.T) {
	router := newRemedyRouter(&stubRemedyRepo{})
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/remedies?limit=5", nil)
	router.ServeHTTP(rec, req)
	require.Equal(t, http.StatusOK, rec.Code)
	var got []map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &got))
	require.Len(t, got, 1)
}

func TestListRemedyByHealerEndpoint(t *testing.T) {
	router := newRemedyRouter(&stubRemedyRepo{})
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/healers/3/remedies", nil)
	router.ServeHTTP(rec, req)
	require.Equal(t, http.StatusOK, rec.Code)
	var got []map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &got))
	require.Len(t, got, 1)
	assert.Equal(t, float64(3), got[0]["healerId"])
}
