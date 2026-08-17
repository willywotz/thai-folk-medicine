package httpapi

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
)

// noAuth is a pass-through middleware for tests that don't exercise auth.
func noAuth(c *gin.Context) { c.Next() }

type fakeVerifier struct{ id int64 }

func (f fakeVerifier) Verify(tokenString string) (int64, error) {
	if tokenString == "good" {
		return f.id, nil
	}
	return 0, errors.New("bad token")
}

func protectedTestRouter() *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(NewAuthMiddleware(fakeVerifier{id: 5}))
	r.GET("/x", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"staffId": c.GetInt64("staffId")})
	})
	return r
}

func TestMiddlewareRejectsMissingToken(t *testing.T) {
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/x", nil)
	protectedTestRouter().ServeHTTP(rec, req)
	assert.Equal(t, http.StatusUnauthorized, rec.Code)
}

func TestMiddlewareRejectsBadToken(t *testing.T) {
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/x", nil)
	req.Header.Set("Authorization", "Bearer nope")
	protectedTestRouter().ServeHTTP(rec, req)
	assert.Equal(t, http.StatusUnauthorized, rec.Code)
}

func TestMiddlewareAcceptsGoodToken(t *testing.T) {
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/x", nil)
	req.Header.Set("Authorization", "Bearer good")
	protectedTestRouter().ServeHTTP(rec, req)
	assert.Equal(t, http.StatusOK, rec.Code)
	assert.Contains(t, rec.Body.String(), "\"staffId\":5")
}

func TestMiddlewareAcceptsSessionCookie(t *testing.T) {
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/x", nil)
	req.AddCookie(&http.Cookie{Name: "session", Value: "good"})
	protectedTestRouter().ServeHTTP(rec, req)
	assert.Equal(t, http.StatusOK, rec.Code)
}

func TestMiddlewareRejectsBadSessionCookie(t *testing.T) {
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/x", nil)
	req.AddCookie(&http.Cookie{Name: "session", Value: "nope"})
	protectedTestRouter().ServeHTTP(rec, req)
	assert.Equal(t, http.StatusUnauthorized, rec.Code)
}
