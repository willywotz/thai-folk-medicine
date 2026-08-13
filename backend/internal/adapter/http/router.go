// Package httpapi holds the Gin router, handlers, and data transfer objects.
package httpapi

import "github.com/gin-gonic/gin"

// NewRouter builds the Gin engine and registers the base routes.
func NewRouter() *gin.Engine {
	r := gin.New()
	r.Use(gin.Recovery())
	r.GET("/health", Health)
	return r
}
