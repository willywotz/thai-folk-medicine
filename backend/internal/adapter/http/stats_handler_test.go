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

	"github.com/willywotz/thai-folk-medicine/backend/internal/usecase"
)

type stubStatsCounter int

func (s stubStatsCounter) CountProvince(_ context.Context) (int, error) { return int(s), nil }
func (s stubStatsCounter) CountDistrict(_ context.Context) (int, error) { return int(s), nil }
func (s stubStatsCounter) Count(_ context.Context) (int, error)         { return int(s), nil }

func newStatsRouter(auth gin.HandlerFunc) *gin.Engine {
	gin.SetMode(gin.TestMode)
	service := usecase.NewStatsService(stubStatsCounter(1), stubStatsCounter(2), stubStatsCounter(3), stubStatsCounter(4), stubStatsCounter(5))
	return NewRouter(auth, NewStatsHandler(service))
}

func TestGetStatsEndpoint(t *testing.T) {
	router := newStatsRouter(noAuth)

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/stats", nil)
	router.ServeHTTP(rec, req)

	require.Equal(t, http.StatusOK, rec.Code)
	var body map[string]int
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &body))
	assert.Equal(t, map[string]int{
		"provinces": 1, "districts": 1, "healers": 2, "remedies": 3, "cases": 4, "herbs": 5,
	}, body)
}

func TestGetStatsRequiresAuth(t *testing.T) {
	deny := func(c *gin.Context) { c.AbortWithStatus(http.StatusUnauthorized) }
	router := newStatsRouter(deny)

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/stats", nil)
	router.ServeHTTP(rec, req)

	assert.Equal(t, http.StatusUnauthorized, rec.Code)
}
