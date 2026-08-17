package httpapi

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/willywotz/thai-folk-medicine/backend/internal/usecase"
)

const sessionCookieName = "session"
const sessionCookieMaxAge = 60 * 60 * 24 // 24h, matches the JWT TTL

// AuthHandler serves authentication endpoints.
type AuthHandler struct {
	service      *usecase.AuthService
	cookieSecure bool
}

// NewAuthHandler builds the auth handler.
func NewAuthHandler(service *usecase.AuthService, cookieSecure bool) *AuthHandler {
	return &AuthHandler{service: service, cookieSecure: cookieSecure}
}

// RegisterRoutes mounts login/logout as public and the session probe as protected.
func (h *AuthHandler) RegisterRoutes(public, protected *gin.RouterGroup) {
	public.POST("/authentication/login", h.Login)
	public.POST("/authentication/logout", h.Logout)
	protected.GET("/authentication/session", h.Session)
}

func (h *AuthHandler) setSessionCookie(c *gin.Context, token string, maxAge int) {
	c.SetSameSite(http.SameSiteLaxMode)
	c.SetCookie(sessionCookieName, token, maxAge, "/", "", h.cookieSecure, true)
}

type loginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

// Login handles POST /api/v1/authentication/login.
func (h *AuthHandler) Login(c *gin.Context) {
	var req loginRequest
	if err := c.ShouldBindJSON(&req); err != nil || req.Username == "" || req.Password == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "username and password are required"})
		return
	}
	tok, err := h.service.Login(c.Request.Context(), req.Username, req.Password)
	if err != nil {
		if errors.Is(err, usecase.ErrInvalidCredentials) {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid credentials"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "cannot log in"})
		return
	}
	h.setSessionCookie(c, tok, sessionCookieMaxAge)
	c.JSON(http.StatusOK, gin.H{"token": tok})
}

// Logout clears the session cookie. POST /api/v1/authentication/logout.
func (h *AuthHandler) Logout(c *gin.Context) {
	h.setSessionCookie(c, "", -1)
	c.Status(http.StatusNoContent)
}

// Session returns the current staff id. GET /api/v1/authentication/session (protected).
func (h *AuthHandler) Session(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"staffId": c.GetInt64("staffId")})
}
