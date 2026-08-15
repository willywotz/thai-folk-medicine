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

	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/location"
	"github.com/willywotz/thai-folk-medicine/backend/internal/usecase"
)

type fakeLocationRepo struct {
	provinces []location.Province
	districts []location.District

	districtCount     int
	deleteProvinceErr error

	healerCount       int
	deleteDistrictErr error
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

func (f *fakeLocationRepo) GetDistrict(_ context.Context, id int64) (location.District, error) {
	for _, d := range f.districts {
		if d.ID == id {
			return d, nil
		}
	}
	return location.District{}, location.ErrNotFound
}

func (f *fakeLocationRepo) GetProvince(_ context.Context, id int64) (location.Province, error) {
	for _, p := range f.provinces {
		if p.ID == id {
			return p, nil
		}
	}
	return location.Province{}, location.ErrProvinceNotFound
}

func (f *fakeLocationRepo) CreateProvince(_ context.Context, nameThai, nameEnglish string) (location.Province, error) {
	return location.Province{ID: 1, NameThai: nameThai, NameEnglish: nameEnglish}, nil
}

func (f *fakeLocationRepo) UpdateProvince(_ context.Context, id int64, nameThai, nameEnglish string) (location.Province, error) {
	return location.Province{ID: id, NameThai: nameThai, NameEnglish: nameEnglish}, nil
}

func (f *fakeLocationRepo) DeleteProvince(context.Context, int64) error {
	return f.deleteProvinceErr
}

func (f *fakeLocationRepo) CountDistrictByProvince(context.Context, int64) (int, error) {
	return f.districtCount, nil
}

func (f *fakeLocationRepo) CreateDistrict(_ context.Context, provinceID int64, nameThai, nameEnglish string) (location.District, error) {
	return location.District{ID: 1, ProvinceID: provinceID, NameThai: nameThai, NameEnglish: nameEnglish}, nil
}

func (f *fakeLocationRepo) UpdateDistrict(_ context.Context, id int64, nameThai, nameEnglish string) (location.District, error) {
	return location.District{ID: id, NameThai: nameThai, NameEnglish: nameEnglish}, nil
}

func (f *fakeLocationRepo) DeleteDistrict(context.Context, int64) error {
	return f.deleteDistrictErr
}

func (f *fakeLocationRepo) CountHealerByDistrict(context.Context, int64) (int, error) {
	return f.healerCount, nil
}

func newTestRouter(repo location.Repository) *gin.Engine {
	gin.SetMode(gin.TestMode)
	service := usecase.NewLocationService(repo, noopPublisher{})
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

func TestGetDistrictEndpoint(t *testing.T) {
	repo := &fakeLocationRepo{districts: []location.District{
		{ID: 5, ProvinceID: 1, NameThai: "กุดชุม", NameEnglish: "Kut Chum"},
	}}
	router := newTestRouter(repo)

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/districts/5", nil)
	router.ServeHTTP(rec, req)

	require.Equal(t, http.StatusOK, rec.Code)

	var body map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &body))
	assert.Equal(t, float64(5), body["id"])
	assert.Equal(t, float64(1), body["provinceId"])
	assert.Equal(t, "กุดชุม", body["nameThai"])
	assert.Equal(t, "Kut Chum", body["nameEnglish"])
}

func TestGetDistrictRejectsBadID(t *testing.T) {
	router := newTestRouter(&fakeLocationRepo{})

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/districts/abc", nil)
	router.ServeHTTP(rec, req)

	assert.Equal(t, http.StatusBadRequest, rec.Code)
}

func TestGetDistrictNotFound(t *testing.T) {
	router := newTestRouter(&fakeLocationRepo{})

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/districts/999", nil)
	router.ServeHTTP(rec, req)

	assert.Equal(t, http.StatusNotFound, rec.Code)
}

func TestCreateProvinceEndpoint(t *testing.T) {
	router := newTestRouter(&fakeLocationRepo{})

	body, err := json.Marshal(map[string]string{"nameThai": "อุบล", "nameEnglish": "Ubon"})
	require.NoError(t, err)
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/v1/provinces", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(rec, req)

	require.Equal(t, http.StatusCreated, rec.Code)

	var got map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &got))
	assert.Equal(t, "Ubon", got["nameEnglish"])
}

func TestGetProvinceEndpoint(t *testing.T) {
	router := newTestRouter(&fakeLocationRepo{provinces: []location.Province{
		{ID: 1, NameThai: "ยโสธร", NameEnglish: "Yasothon"},
	}})

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/provinces/1", nil)
	router.ServeHTTP(rec, req)

	require.Equal(t, http.StatusOK, rec.Code)

	var got map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &got))
	assert.Equal(t, "Yasothon", got["nameEnglish"])
}

func TestGetProvinceNotFound(t *testing.T) {
	router := newTestRouter(&fakeLocationRepo{})

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/provinces/999", nil)
	router.ServeHTTP(rec, req)

	assert.Equal(t, http.StatusNotFound, rec.Code)
}

func TestGetProvinceRejectsBadID(t *testing.T) {
	router := newTestRouter(&fakeLocationRepo{})

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/provinces/abc", nil)
	router.ServeHTTP(rec, req)

	assert.Equal(t, http.StatusBadRequest, rec.Code)
}

func TestUpdateProvinceEndpoint(t *testing.T) {
	router := newTestRouter(&fakeLocationRepo{provinces: []location.Province{{ID: 1}}})

	body, err := json.Marshal(map[string]string{"nameThai": "อุบล", "nameEnglish": "Ubon"})
	require.NoError(t, err)
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPut, "/api/v1/provinces/1", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(rec, req)

	require.Equal(t, http.StatusOK, rec.Code)

	var got map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &got))
	assert.Equal(t, "Ubon", got["nameEnglish"])
}

func TestDeleteProvinceEndpoint(t *testing.T) {
	router := newTestRouter(&fakeLocationRepo{})

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodDelete, "/api/v1/provinces/1", nil)
	router.ServeHTTP(rec, req)

	assert.Equal(t, http.StatusNoContent, rec.Code)
}

func TestDeleteProvinceRejectsWhenReferenced(t *testing.T) {
	router := newTestRouter(&fakeLocationRepo{districtCount: 1})

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodDelete, "/api/v1/provinces/1", nil)
	router.ServeHTTP(rec, req)

	assert.Equal(t, http.StatusConflict, rec.Code)
}

func TestCreateProvinceRejectsBadBody(t *testing.T) {
	router := newTestRouter(&fakeLocationRepo{})

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/v1/provinces", bytes.NewReader([]byte("not json")))
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(rec, req)

	assert.Equal(t, http.StatusBadRequest, rec.Code)
}

func TestCreateDistrictEndpoint(t *testing.T) {
	router := newTestRouter(&fakeLocationRepo{})

	body, err := json.Marshal(map[string]any{"provinceId": 1, "nameThai": "กุดชุม", "nameEnglish": "Kut Chum"})
	require.NoError(t, err)
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/v1/districts", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(rec, req)

	require.Equal(t, http.StatusCreated, rec.Code)

	var got map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &got))
	assert.Equal(t, "Kut Chum", got["nameEnglish"])
	assert.Equal(t, float64(1), got["provinceId"])
}

func TestCreateDistrictRejectsBadBody(t *testing.T) {
	router := newTestRouter(&fakeLocationRepo{})

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/v1/districts", bytes.NewReader([]byte("not json")))
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(rec, req)

	assert.Equal(t, http.StatusBadRequest, rec.Code)
}

func TestUpdateDistrictEndpoint(t *testing.T) {
	router := newTestRouter(&fakeLocationRepo{districts: []location.District{{ID: 5, ProvinceID: 1}}})

	body, err := json.Marshal(map[string]string{"nameThai": "กุดชุม", "nameEnglish": "Kut Chum"})
	require.NoError(t, err)
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPut, "/api/v1/districts/5", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(rec, req)

	require.Equal(t, http.StatusOK, rec.Code)

	var got map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &got))
	assert.Equal(t, "Kut Chum", got["nameEnglish"])
}

func TestUpdateDistrictRejectsBadID(t *testing.T) {
	router := newTestRouter(&fakeLocationRepo{})

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPut, "/api/v1/districts/abc", bytes.NewReader([]byte("{}")))
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(rec, req)

	assert.Equal(t, http.StatusBadRequest, rec.Code)
}

func TestDeleteDistrictEndpoint(t *testing.T) {
	router := newTestRouter(&fakeLocationRepo{})

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodDelete, "/api/v1/districts/5", nil)
	router.ServeHTTP(rec, req)

	assert.Equal(t, http.StatusNoContent, rec.Code)
}

func TestDeleteDistrictRejectsWhenReferenced(t *testing.T) {
	router := newTestRouter(&fakeLocationRepo{healerCount: 1})

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodDelete, "/api/v1/districts/5", nil)
	router.ServeHTTP(rec, req)

	assert.Equal(t, http.StatusConflict, rec.Code)
}
