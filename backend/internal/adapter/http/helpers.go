package httpapi

import (
	"strconv"

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
