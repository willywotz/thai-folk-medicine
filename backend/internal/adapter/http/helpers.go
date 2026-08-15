package httpapi

import (
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"

	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/listing"
)

// parsePageParams reads page and pageSize query params, returning the
// resulting offset window alongside the normalized page and page size.
func parsePageParams(c *gin.Context, defaultSize int) (listing.Params, int, int) {
	page, _ := strconv.Atoi(c.Query("page"))
	if page < 1 {
		page = 1
	}
	size, _ := strconv.Atoi(c.Query("pageSize"))
	params := listing.FromPageSize(page, size, defaultSize)
	return params, page, params.Limit
}

// pageDTO is the JSON envelope for a paginated list response.
type pageDTO[T any] struct {
	Items      []T `json:"items"`
	Page       int `json:"page"`
	PageSize   int `json:"pageSize"`
	Total      int `json:"total"`
	TotalPages int `json:"totalPages"`
}

// newPageDTO builds a pageDTO, ensuring Items is never nil.
func newPageDTO[T any](items []T, page, pageSize, total int) pageDTO[T] {
	if items == nil {
		items = make([]T, 0)
	}
	return pageDTO[T]{
		Items: items, Page: page, PageSize: pageSize,
		Total: total, TotalPages: listing.TotalPages(total, pageSize),
	}
}

// optionalInt64Query parses an int64 query param, returning nil when the
// param is missing or invalid.
func optionalInt64Query(c *gin.Context, key string) *int64 {
	raw := c.Query(key)
	if raw == "" {
		return nil
	}
	v, err := strconv.ParseInt(raw, 10, 64)
	if err != nil {
		return nil
	}
	return &v
}

// trimmedQuery reads a query param and trims surrounding whitespace.
func trimmedQuery(c *gin.Context, key string) string {
	return strings.TrimSpace(c.Query(key))
}
