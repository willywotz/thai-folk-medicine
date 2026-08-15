package listing

import "testing"

func TestFromPageSize(t *testing.T) {
	cases := []struct {
		name                  string
		page, pageSize, def   int
		wantLimit, wantOffset int
	}{
		{"defaults", 0, 0, 12, 12, 0},
		{"page two", 2, 12, 12, 12, 12},
		{"negative page clamps to one", -3, 12, 12, 12, 0},
		{"pageSize capped at 48", 1, 500, 12, 48, 0},
		{"pageSize below one uses default", 1, 0, 20, 20, 0},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			p := FromPageSize(c.page, c.pageSize, c.def)
			if p.Limit != c.wantLimit || p.Offset != c.wantOffset {
				t.Fatalf("got {%d,%d} want {%d,%d}", p.Limit, p.Offset, c.wantLimit, c.wantOffset)
			}
		})
	}
}

func TestTotalPages(t *testing.T) {
	for _, c := range []struct{ total, size, want int }{
		{0, 12, 1}, {12, 12, 1}, {13, 12, 2}, {146, 12, 13},
	} {
		if got := TotalPages(c.total, c.size); got != c.want {
			t.Fatalf("TotalPages(%d,%d)=%d want %d", c.total, c.size, got, c.want)
		}
	}
}
