package httpapi

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestParsePageParams(t *testing.T) {
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodGet, "/x?page=2&pageSize=100", nil)
	p, page, size := parsePageParams(c, 12)
	if page != 2 || size != 48 || p.Offset != 48 || p.Limit != 48 {
		t.Fatalf("got page=%d size=%d params=%+v", page, size, p)
	}
}

func TestNewPageDTO_NilItemsAndTotalPages(t *testing.T) {
	dto := newPageDTO[int](nil, 1, 12, 0)
	if dto.Items == nil || dto.TotalPages != 1 {
		t.Fatalf("got %+v", dto)
	}
}
