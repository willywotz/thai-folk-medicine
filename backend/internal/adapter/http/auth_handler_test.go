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
	"golang.org/x/crypto/bcrypt"

	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/staff"
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
	return NewRouter(noAuth, NewAuthHandler(service))
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
