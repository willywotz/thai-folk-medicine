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
	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/healer"
	"github.com/willywotz/thai-folk-medicine/backend/internal/usecase"
)

type stubHealerRepo struct {
	getErr  error
	created healer.Healer
}

func (s *stubHealerRepo) Create(_ context.Context, p healer.CreateParams) (healer.Healer, error) {
	return healer.Healer{ID: 1, DistrictID: p.DistrictID, FullName: p.FullName}, nil
}
func (s *stubHealerRepo) GetByID(_ context.Context, id int64) (healer.Healer, error) {
	if s.getErr != nil {
		return healer.Healer{}, s.getErr
	}
	return healer.Healer{ID: id, FullName: "หมอ ก"}, nil
}
func (s *stubHealerRepo) ListByDistrict(_ context.Context, districtID int64) ([]healer.Healer, error) {
	return []healer.Healer{{ID: 1, DistrictID: districtID, FullName: "หมอ ก"}}, nil
}
func (s *stubHealerRepo) Update(_ context.Context, p healer.UpdateParams) (healer.Healer, error) {
	return healer.Healer{ID: p.ID, FullName: p.FullName}, nil
}
func (s *stubHealerRepo) Delete(context.Context, int64) error { return nil }

type noopPublisher struct{}

func (noopPublisher) Publish(context.Context, event.Event) {}

func newHealerRouter(repo healer.Repository) *gin.Engine {
	gin.SetMode(gin.TestMode)
	service := usecase.NewHealerService(repo, noopPublisher{})
	return NewRouter(noAuth, NewHealerHandler(service))
}

func TestCreateHealerEndpoint(t *testing.T) {
	router := newHealerRouter(&stubHealerRepo{})

	body, _ := json.Marshal(map[string]any{"districtId": 2, "fullName": "หมอ ก", "specialty": "สมุนไพร"})
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/v1/healers", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(rec, req)

	require.Equal(t, http.StatusCreated, rec.Code)
	var got map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &got))
	assert.Equal(t, "หมอ ก", got["fullName"])
	assert.Equal(t, float64(2), got["districtId"])
}

func TestCreateHealerRejectsEmptyName(t *testing.T) {
	router := newHealerRouter(&stubHealerRepo{})

	body, _ := json.Marshal(map[string]any{"districtId": 2, "fullName": ""})
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/v1/healers", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(rec, req)

	assert.Equal(t, http.StatusBadRequest, rec.Code)
}

func TestGetHealerNotFound(t *testing.T) {
	router := newHealerRouter(&stubHealerRepo{getErr: healer.ErrNotFound})

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/healers/1", nil)
	router.ServeHTTP(rec, req)

	assert.Equal(t, http.StatusNotFound, rec.Code)
}

func TestListHealerByDistrictEndpoint(t *testing.T) {
	router := newHealerRouter(&stubHealerRepo{})

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/districts/2/healers", nil)
	router.ServeHTTP(rec, req)

	require.Equal(t, http.StatusOK, rec.Code)
	var got []map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &got))
	require.Len(t, got, 1)
	assert.Equal(t, float64(2), got[0]["districtId"])
}
