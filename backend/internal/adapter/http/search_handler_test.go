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

	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/listing"
	"github.com/willywotz/thai-folk-medicine/backend/internal/usecase/search"
)

type stubSearchReader struct{ out listing.Page[search.Hit] }

func (s stubSearchReader) SearchAll(context.Context, string, listing.Params) (listing.Page[search.Hit], error) {
	return s.out, nil
}

func newSearchRouter(reader search.Reader) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	public := r.Group("/api/v1")
	protected := r.Group("/api/v1")
	NewSearchHandler(search.NewService(reader)).RegisterRoutes(public, protected)
	return r
}

func TestSearchEndpointReturnsMergedMatches(t *testing.T) {
	r := newSearchRouter(stubSearchReader{out: listing.Page[search.Hit]{
		Items: []search.Hit{
			{Type: "remedy", ID: 1, Title: "ยาแก้ไข้", Subtitle: "ไข้", Score: 0.9},
			{Type: "herb", ID: 4, Title: "ขิง", Subtitle: "Ginger", Score: 0.5},
		},
		Total: 2,
	}})
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/search?searchTerm=ยา", nil)
	r.ServeHTTP(w, req)

	require.Equal(t, http.StatusOK, w.Code)
	var body struct {
		Items []struct {
			Type  string `json:"type"`
			ID    int64  `json:"id"`
			Title string `json:"title"`
		} `json:"items"`
		Total int `json:"total"`
	}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &body))
	require.Len(t, body.Items, 2)
	assert.Equal(t, "remedy", body.Items[0].Type)
	assert.Equal(t, "herb", body.Items[1].Type)
	assert.Equal(t, 2, body.Total)
}

func TestSearchEndpointRejectsShortTerm(t *testing.T) {
	r := newSearchRouter(stubSearchReader{})
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/search?searchTerm=ก", nil)
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}
