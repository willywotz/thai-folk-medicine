// Package location holds the province and district entities and their
// repository interface. It imports no framework code.
package location

import (
	"context"
	"errors"
)

// ErrNotFound means no district has the given id.
var ErrNotFound = errors.New("district not found")

// ErrProvinceNotFound means no province has the given id.
var ErrProvinceNotFound = errors.New("province not found")

// ErrProvinceReferenced means the province still has districts and cannot be deleted.
var ErrProvinceReferenced = errors.New("province is referenced by other records")

// ErrDistrictReferenced means the district still has healers and cannot be deleted.
var ErrDistrictReferenced = errors.New("district is referenced by other records")

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

// Repository reads and writes provinces and districts.
type Repository interface {
	ListProvince(ctx context.Context) ([]Province, error)
	ListDistrictByProvince(ctx context.Context, provinceID int64) ([]District, error)
	GetDistrict(ctx context.Context, id int64) (District, error)
	GetProvince(ctx context.Context, id int64) (Province, error)
	CreateProvince(ctx context.Context, nameThai, nameEnglish string) (Province, error)
	UpdateProvince(ctx context.Context, id int64, nameThai, nameEnglish string) (Province, error)
	DeleteProvince(ctx context.Context, id int64) error
	CountDistrictByProvince(ctx context.Context, provinceID int64) (int, error)
	CreateDistrict(ctx context.Context, provinceID int64, nameThai, nameEnglish string) (District, error)
	UpdateDistrict(ctx context.Context, id int64, nameThai, nameEnglish string) (District, error)
	DeleteDistrict(ctx context.Context, id int64) error
	CountHealerByDistrict(ctx context.Context, districtID int64) (int, error)
}
