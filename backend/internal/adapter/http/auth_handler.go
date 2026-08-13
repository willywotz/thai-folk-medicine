package httpapi

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/willywotz/thai-folk-medicine/backend/internal/usecase"
)

// AuthHandler serves the login endpoint.
type AuthHandler struct {
	service *usecase.AuthService
}

// NewAuthHandler builds the auth handler.
func NewAuthHandler(service *usecase.AuthService) *AuthHandler {
	return &AuthHandler{service: service}
}

// RegisterRoutes mounts the login route on the public group.
func (h *AuthHandler) RegisterRoutes(public, _ *gin.RouterGroup) {
	public.POST("/authentication/login", h.Login)
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
	c.JSON(http.StatusOK, gin.H{"token": tok})
}
