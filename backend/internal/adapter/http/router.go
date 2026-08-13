// Package httpapi holds the Gin router, handlers, and data transfer objects.
package httpapi

import "github.com/gin-gonic/gin"

// RouteRegistrar registers its routes onto the versioned API group.
type RouteRegistrar interface {
	RegisterRoutes(rg *gin.RouterGroup)
}

// NewRouter builds the Gin engine, mounts /health, and lets each registrar add
// its routes under /api/v1.
func NewRouter(registrar ...RouteRegistrar) *gin.Engine {
	r := gin.New()
	r.Use(gin.Recovery())
	r.GET("/health", Health)

	v1 := r.Group("/api/v1")
	for _, reg := range registrar {
		reg.RegisterRoutes(v1)
	}
	return r
}
