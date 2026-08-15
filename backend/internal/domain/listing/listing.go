// Package listing holds the pagination kernel shared by every list use case.
package listing

const maxPageSize = 48

// Params is an offset window into a result set.
type Params struct {
	Limit  int
	Offset int
}

// Page is one page of results plus the total matching count.
type Page[T any] struct {
	Items []T
	Total int
}

// FromPageSize converts a 1-indexed page and a page size into a Params window.
func FromPageSize(page, pageSize, defaultSize int) Params {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = defaultSize
	}
	if pageSize > maxPageSize {
		pageSize = maxPageSize
	}
	return Params{Limit: pageSize, Offset: (page - 1) * pageSize}
}

// TotalPages returns the page count for a total and page size, never below one.
func TotalPages(total, pageSize int) int {
	if total <= 0 || pageSize <= 0 {
		return 1
	}
	return (total + pageSize - 1) / pageSize
}
