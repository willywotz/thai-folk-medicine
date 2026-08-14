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

	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/healer"
	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/herb"
	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/remedy"
	"github.com/willywotz/thai-folk-medicine/backend/internal/usecase/search"
)

type stubRemedyReader struct{ out []remedy.SearchResult }

func (s stubRemedyReader) Search(context.Context, string) ([]remedy.SearchResult, error) {
	return s.out, nil
}

type stubHealerReader struct{ out []healer.Healer }

func (s stubHealerReader) Search(context.Context, string) ([]healer.Healer, error) {
	return s.out, nil
}

type stubHerbReader struct{ out []herb.Herb }

func (s stubHerbReader) Search(context.Context, string) ([]herb.Herb, error) {
	return s.out, nil
}

func newSearchRouter(rr search.RemedyReader, hr search.HealerReader, hbr search.HerbReader) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	public := r.Group("/api/v1")
	protected := r.Group("/api/v1")
	NewSearchHandler(search.NewService(rr, hr, hbr)).RegisterRoutes(public, protected)
	return r
}

func TestSearchEndpointReturnsMatches(t *testing.T) {
	r := newSearchRouter(
		stubRemedyReader{out: []remedy.SearchResult{{ID: 1, Name: "ยาแก้ไข้", HealerID: 2, HealerFullName: "หมอ"}}},
		stubHealerReader{out: []healer.Healer{{ID: 2, FullName: "หมอ", DistrictID: 3}}},
		stubHerbReader{out: []herb.Herb{{ID: 4, NameThai: "ขิง"}}},
	)
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/search?searchTerm=ยา", nil)
	r.ServeHTTP(w, req)

	require.Equal(t, http.StatusOK, w.Code)
	var body struct {
		Remedies []struct {
			ID             int64  `json:"id"`
			Name           string `json:"name"`
			HealerFullName string `json:"healerFullName"`
		} `json:"remedies"`
		Healers []struct {
			ID         int64 `json:"id"`
			DistrictID int64 `json:"districtId"`
		} `json:"healers"`
		Herbs []struct {
			ID       int64  `json:"id"`
			NameThai string `json:"nameThai"`
		} `json:"herbs"`
	}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &body))
	require.Len(t, body.Remedies, 1)
	assert.Equal(t, "หมอ", body.Remedies[0].HealerFullName)
	require.Len(t, body.Healers, 1)
	assert.Equal(t, int64(3), body.Healers[0].DistrictID)
	require.Len(t, body.Herbs, 1)
	assert.Equal(t, "ขิง", body.Herbs[0].NameThai)
}

func TestSearchEndpointRejectsShortTerm(t *testing.T) {
	r := newSearchRouter(stubRemedyReader{}, stubHealerReader{}, stubHerbReader{})
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/search?searchTerm=ก", nil)
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}
