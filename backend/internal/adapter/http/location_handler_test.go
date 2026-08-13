package httpapi

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/location"
	"github.com/willywotz/thai-folk-medicine/backend/internal/usecase"
)

type fakeLocationRepo struct {
	provinces []location.Province
	districts []location.District
}

func (f *fakeLocationRepo) ListProvince(context.Context) ([]location.Province, error) {
	return f.provinces, nil
}

func (f *fakeLocationRepo) ListDistrictByProvince(_ context.Context, provinceID int64) ([]location.District, error) {
	var out []location.District
	for _, d := range f.districts {
		if d.ProvinceID == provinceID {
			out = append(out, d)
		}
	}
	return out, nil
}

func newTestRouter(repo location.Repository) *gin.Engine {
	gin.SetMode(gin.TestMode)
	service := usecase.NewLocationService(repo)
	handler := NewLocationHandler(service)
	return NewRouter(noAuth, handler)
}

func TestListProvinceEndpoint(t *testing.T) {
	repo := &fakeLocationRepo{provinces: []location.Province{
		{ID: 1, NameThai: "ยโสธร", NameEnglish: "Yasothon"},
	}}
	router := newTestRouter(repo)

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/provinces", nil)
	router.ServeHTTP(rec, req)

	require.Equal(t, http.StatusOK, rec.Code)

	var body []map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &body))
	require.Len(t, body, 1)
	assert.Equal(t, "Yasothon", body[0]["nameEnglish"])
	assert.Equal(t, float64(1), body[0]["id"])
}

func TestListDistrictEndpoint(t *testing.T) {
	repo := &fakeLocationRepo{districts: []location.District{
		{ID: 5, ProvinceID: 1, NameThai: "กุดชุม", NameEnglish: "Kut Chum"},
	}}
	router := newTestRouter(repo)

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/provinces/1/districts", nil)
	router.ServeHTTP(rec, req)

	require.Equal(t, http.StatusOK, rec.Code)

	var body []map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &body))
	require.Len(t, body, 1)
	assert.Equal(t, "Kut Chum", body[0]["nameEnglish"])
	assert.Equal(t, float64(1), body[0]["provinceId"])
}

func TestListDistrictRejectsBadProvinceID(t *testing.T) {
	router := newTestRouter(&fakeLocationRepo{})

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/provinces/abc/districts", nil)
	router.ServeHTTP(rec, req)

	assert.Equal(t, http.StatusBadRequest, rec.Code)
}
