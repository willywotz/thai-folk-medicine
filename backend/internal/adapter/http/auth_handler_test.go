package httpapi

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"golang.org/x/crypto/bcrypt"

	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/staff"
	"github.com/willywotz/thai-folk-medicine/backend/internal/platform/token"
	"github.com/willywotz/thai-folk-medicine/backend/internal/usecase"
)

type loginStaffRepo struct{ user staff.Staff }

func (r loginStaffRepo) GetByUsername(_ context.Context, username string) (staff.Staff, error) {
	if username == r.user.Username {
		return r.user, nil
	}
	return staff.Staff{}, staff.ErrNotFound
}
func (r loginStaffRepo) Create(context.Context, staff.CreateParams) (staff.Staff, error) {
	return staff.Staff{}, nil
}
func (r loginStaffRepo) Count(context.Context) (int64, error) { return 1, nil }

type stubIssuer struct{}

func (stubIssuer) Issue(int64) (string, error) { return "signed-token", nil }

func loginRouter(t *testing.T) *gin.Engine {
	t.Helper()
	gin.SetMode(gin.TestMode)
	hash, err := bcrypt.GenerateFromPassword([]byte("secret"), bcrypt.DefaultCost)
	require.NoError(t, err)
	repo := loginStaffRepo{user: staff.Staff{ID: 1, Username: "admin", PasswordHash: string(hash)}}
	service := usecase.NewAuthService(repo, stubIssuer{})
	return NewRouter(noAuth, NewAuthHandler(service, false))
}

func loginTestRouter() *gin.Engine {
	gin.SetMode(gin.TestMode)
	hash, _ := bcrypt.GenerateFromPassword([]byte("admin"), bcrypt.DefaultCost)
	repo := loginStaffRepo{user: staff.Staff{ID: 1, Username: "admin", PasswordHash: string(hash)}}
	service := usecase.NewAuthService(repo, token.NewManager("test-secret", time.Hour))
	r := gin.New()
	r.Use(gin.Recovery())
	public := r.Group("/api/v1")
	protected := r.Group("/api/v1")
	protected.Use(NewAuthMiddleware(token.NewManager("test-secret", time.Hour)))
	NewAuthHandler(service, false).RegisterRoutes(public, protected)
	return r
}

func TestLoginEndpointSucceeds(t *testing.T) {
	body, _ := json.Marshal(map[string]string{"username": "admin", "password": "secret"})
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/v1/authentication/login", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	loginRouter(t).ServeHTTP(rec, req)

	require.Equal(t, http.StatusOK, rec.Code)
	var got map[string]string
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &got))
	assert.Equal(t, "signed-token", got["token"])
}

func TestLoginEndpointRejectsWrongPassword(t *testing.T) {
	body, _ := json.Marshal(map[string]string{"username": "admin", "password": "wrong"})
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/v1/authentication/login", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	loginRouter(t).ServeHTTP(rec, req)

	assert.Equal(t, http.StatusUnauthorized, rec.Code)
}

func TestLoginEndpointRejectsEmptyBody(t *testing.T) {
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/v1/authentication/login", bytes.NewReader([]byte(`{}`)))
	req.Header.Set("Content-Type", "application/json")
	loginRouter(t).ServeHTTP(rec, req)

	assert.Equal(t, http.StatusBadRequest, rec.Code)
}

func TestLoginSetsSessionCookie(t *testing.T) {
	rec := httptest.NewRecorder()
	body := `{"username":"admin","password":"admin"}`
	req := httptest.NewRequest(http.MethodPost, "/api/v1/authentication/login", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	loginTestRouter().ServeHTTP(rec, req)
	assert.Equal(t, http.StatusOK, rec.Code)
	cookie := rec.Result().Cookies()
	require.Len(t, cookie, 1)
	assert.Equal(t, "session", cookie[0].Name)
	assert.NotEmpty(t, cookie[0].Value)
	assert.True(t, cookie[0].HttpOnly)
}

func TestLogoutClearsSessionCookie(t *testing.T) {
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/v1/authentication/logout", nil)
	loginTestRouter().ServeHTTP(rec, req)
	assert.Equal(t, http.StatusNoContent, rec.Code)
	cookie := rec.Result().Cookies()
	require.Len(t, cookie, 1)
	assert.Equal(t, "session", cookie[0].Name)
	assert.True(t, cookie[0].MaxAge < 0)
}
