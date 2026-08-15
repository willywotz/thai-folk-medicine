// Package location holds the province and district entities and their
// repository interface. It imports no framework code.
package location

import (
	"context"
	"errors"
)

// ErrNotFound means no district has the given id.
var ErrNotFound = errors.New("district not found")

// Province is one Thai province.
type Province struct {
	ID          int64
	NameThai    string
	NameEnglish string
}

// District is one district (อำเภอ) inside a province.
type District struct {
	ID          int64
	ProvinceID  int64
	NameThai    string
	NameEnglish string
}

// Repository reads provinces and districts.
type Repository interface {
	ListProvince(ctx context.Context) ([]Province, error)
	ListDistrictByProvince(ctx context.Context, provinceID int64) ([]District, error)
	GetDistrict(ctx context.Context, id int64) (District, error)
}
