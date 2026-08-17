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

// NewAuthMiddleware guards routes: it requires a valid staff JWT from either the
// Authorization: Bearer header or the "session" cookie, and stores the staff id
// in the context as "staffId".
func NewAuthMiddleware(verifier TokenVerifier) gin.HandlerFunc {
	return func(c *gin.Context) {
		tokenString, ok := strings.CutPrefix(c.GetHeader("Authorization"), "Bearer ")
		if !ok || tokenString == "" {
			if cookie, err := c.Cookie("session"); err == nil && cookie != "" {
				tokenString = cookie
			} else {
				c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "missing bearer token or session cookie"})
				return
			}
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
