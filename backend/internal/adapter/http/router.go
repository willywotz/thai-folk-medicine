// Package httpapi holds the Gin router, handlers, and data transfer objects.
package httpapi

import "github.com/gin-gonic/gin"

// RouteRegistrar registers its public (open) and protected (JWT-guarded) routes.
type RouteRegistrar interface {
	RegisterRoutes(public, protected *gin.RouterGroup)
}

// NewRouter builds the Gin engine. Public GET routes are open; protected routes
// go through the auth middleware. /health is always open.
func NewRouter(auth gin.HandlerFunc, registrar ...RouteRegistrar) *gin.Engine {
	r := gin.New()
	r.Use(gin.Recovery())
	r.GET("/health", Health)

	public := r.Group("/api/v1")
	protected := r.Group("/api/v1")
	protected.Use(auth)

	for _, reg := range registrar {
		reg.RegisterRoutes(public, protected)
	}
	return r
}
