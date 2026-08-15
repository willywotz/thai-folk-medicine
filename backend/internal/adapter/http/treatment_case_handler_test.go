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

	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/listing"
	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/treatmentcase"
	"github.com/willywotz/thai-folk-medicine/backend/internal/usecase"
)

type stubCaseRepo struct{ getErr error }

func (s *stubCaseRepo) Create(_ context.Context, p treatmentcase.CreateParams) (treatmentcase.TreatmentCase, error) {
	return treatmentcase.TreatmentCase{ID: 1, RemedyID: p.RemedyID, HealerID: p.HealerID, PatientAge: p.PatientAge, TreatedOn: p.TreatedOn}, nil
}
func (s *stubCaseRepo) GetByID(_ context.Context, id int64) (treatmentcase.TreatmentCase, error) {
	if s.getErr != nil {
		return treatmentcase.TreatmentCase{}, s.getErr
	}
	return treatmentcase.TreatmentCase{ID: id}, nil
}
func (s *stubCaseRepo) ListByRemedyPage(_ context.Context, remedyID int64, _ listing.Params) (listing.Page[treatmentcase.TreatmentCase], error) {
	return listing.Page[treatmentcase.TreatmentCase]{Items: []treatmentcase.TreatmentCase{{ID: 1, RemedyID: remedyID}}, Total: 1}, nil
}
func (s *stubCaseRepo) ListPage(context.Context, listing.Params) (listing.Page[treatmentcase.TreatmentCase], error) {
	return listing.Page[treatmentcase.TreatmentCase]{Items: []treatmentcase.TreatmentCase{{ID: 1}}, Total: 1}, nil
}
func (s *stubCaseRepo) Update(_ context.Context, p treatmentcase.UpdateParams) (treatmentcase.TreatmentCase, error) {
	return treatmentcase.TreatmentCase{ID: p.ID, RemedyID: p.RemedyID, HealerID: p.HealerID}, nil
}
func (s *stubCaseRepo) Delete(context.Context, int64) error { return nil }

func newCaseRouter(repo treatmentcase.Repository) *gin.Engine {
	gin.SetMode(gin.TestMode)
	service := usecase.NewTreatmentCaseService(repo, noopPub{})
	return NewRouter(noAuth, NewTreatmentCaseHandler(service))
}

func TestCreateCaseEndpoint(t *testing.T) {
	router := newCaseRouter(&stubCaseRepo{})
	body, _ := json.Marshal(map[string]any{
		"remedyId": 2, "healerId": 3, "patientAge": 40, "patientSex": "male", "treatedOn": "2026-03-01",
	})
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/v1/treatment-cases", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(rec, req)

	require.Equal(t, http.StatusCreated, rec.Code)
	var got map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &got))
	assert.Equal(t, float64(40), got["patientAge"])
	assert.Equal(t, "2026-03-01", got["treatedOn"])
}

func TestCreateCaseRejectsBadDate(t *testing.T) {
	router := newCaseRouter(&stubCaseRepo{})
	body, _ := json.Marshal(map[string]any{
		"remedyId": 2, "healerId": 3, "patientAge": 40, "patientSex": "male", "treatedOn": "01-03-2026",
	})
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/v1/treatment-cases", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(rec, req)
	assert.Equal(t, http.StatusBadRequest, rec.Code)
}

func TestUpdateCaseReassignsRemedyAndHealerEndpoint(t *testing.T) {
	router := newCaseRouter(&stubCaseRepo{})
	body, _ := json.Marshal(map[string]any{
		"remedyId": 5, "healerId": 9, "patientAge": 40, "patientSex": "male", "treatedOn": "2026-03-01",
	})
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPut, "/api/v1/treatment-cases/1", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(rec, req)

	require.Equal(t, http.StatusOK, rec.Code)
	var got map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &got))
	assert.Equal(t, float64(5), got["remedyId"])
	assert.Equal(t, float64(9), got["healerId"])
}

func TestGetCaseNotFound(t *testing.T) {
	router := newCaseRouter(&stubCaseRepo{getErr: treatmentcase.ErrNotFound})
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/treatment-cases/1", nil)
	router.ServeHTTP(rec, req)
	assert.Equal(t, http.StatusNotFound, rec.Code)
}

func TestListRecentCaseEndpoint(t *testing.T) {
	router := newCaseRouter(&stubCaseRepo{})
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/treatment-cases?page=1&pageSize=5", nil)
	router.ServeHTTP(rec, req)
	require.Equal(t, http.StatusOK, rec.Code)
	var body struct {
		Items []map[string]any `json:"items"`
		Total int              `json:"total"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &body))
	require.Len(t, body.Items, 1)
	assert.Equal(t, 1, body.Total)
}

func TestListCaseByRemedyEndpoint(t *testing.T) {
	router := newCaseRouter(&stubCaseRepo{})
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/remedies/2/treatment-cases", nil)
	router.ServeHTTP(rec, req)
	require.Equal(t, http.StatusOK, rec.Code)
	var body struct {
		Items []map[string]any `json:"items"`
		Total int              `json:"total"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &body))
	require.Len(t, body.Items, 1)
	assert.Equal(t, float64(2), body.Items[0]["remedyId"])
	assert.Equal(t, 1, body.Total)
}
