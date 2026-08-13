package httpapi

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// Health reports that the service is running.
func Health(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}
