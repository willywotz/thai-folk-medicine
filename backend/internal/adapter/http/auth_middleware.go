package httpapi

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

// TokenVerifier verifies a token string and returns its staff id.
type TokenVerifier interface {
	Verify(tokenString string) (int64, error)
}

// NewAuthMiddleware guards routes: it requires a valid Bearer token and stores
// the staff id in the context as "staffId".
func NewAuthMiddleware(verifier TokenVerifier) gin.HandlerFunc {
	return func(c *gin.Context) {
		header := c.GetHeader("Authorization")
		tokenString, ok := strings.CutPrefix(header, "Bearer ")
		if !ok || tokenString == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "missing bearer token"})
			return
		}
		staffID, err := verifier.Verify(tokenString)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid token"})
			return
		}
		c.Set("staffId", staffID)
		c.Next()
	}
}
