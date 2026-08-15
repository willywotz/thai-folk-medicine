package httpapi

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/audit"
	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/listing"
	audituc "github.com/willywotz/thai-folk-medicine/backend/internal/usecase/audit"
)

type stubActivityRepo struct {
	page listing.Page[audit.Entry]
}

func (s *stubActivityRepo) Record(context.Context, string, []byte) error { return nil }
func (s *stubActivityRepo) List(context.Context, listing.Params) (listing.Page[audit.Entry], error) {
	return s.page, nil
}

func newActivityRouter(repo audit.Repository) *gin.Engine {
	gin.SetMode(gin.TestMode)
	return NewRouter(noAuth, NewActivityHandler(audituc.NewReader(repo)))
}

func TestListActivityEndpoint(t *testing.T) {
	repo := &stubActivityRepo{page: listing.Page[audit.Entry]{
		Items: []audit.Entry{{
			ID: 1, EventName: "healer.created",
			Payload: json.RawMessage(`{"HealerID":5}`), OccurredAt: time.Now(),
		}},
		Total: 1,
	}}
	router := newActivityRouter(repo)

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/activity?page=1&pageSize=10", nil)
	router.ServeHTTP(rec, req)

	require.Equal(t, http.StatusOK, rec.Code)
	var body struct {
		Items      []map[string]any `json:"items"`
		Page       int              `json:"page"`
		PageSize   int              `json:"pageSize"`
		Total      int              `json:"total"`
		TotalPages int              `json:"totalPages"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &body))
	require.Len(t, body.Items, 1)
	assert.Equal(t, "healer.created", body.Items[0]["eventName"])
	assert.Equal(t, 1, body.Total)
}

func TestListActivityRequiresAuth(t *testing.T) {
	gin.SetMode(gin.TestMode)
	deny := func(c *gin.Context) { c.AbortWithStatus(http.StatusUnauthorized) }
	router := NewRouter(deny, NewActivityHandler(audituc.NewReader(&stubActivityRepo{})))

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/activity", nil)
	router.ServeHTTP(rec, req)

	assert.Equal(t, http.StatusUnauthorized, rec.Code)
}
