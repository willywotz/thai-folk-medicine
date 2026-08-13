package httpapi

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	"github.com/willywotz/thai-folk-medicine/backend/internal/usecase"
)

// LocationHandler serves the province and district read endpoints.
type LocationHandler struct {
	service *usecase.LocationService
}

// NewLocationHandler builds the location handler.
func NewLocationHandler(service *usecase.LocationService) *LocationHandler {
	return &LocationHandler{service: service}
}

// RegisterRoutes mounts the province and district read routes.
func (h *LocationHandler) RegisterRoutes(rg *gin.RouterGroup) {
	rg.GET("/provinces", h.ListProvince)
	rg.GET("/provinces/:provinceId/districts", h.ListDistrictByProvince)
}

type provinceDTO struct {
	ID          int64  `json:"id"`
	NameThai    string `json:"nameThai"`
	NameEnglish string `json:"nameEnglish"`
}

type districtDTO struct {
	ID          int64  `json:"id"`
	ProvinceID  int64  `json:"provinceId"`
	NameThai    string `json:"nameThai"`
	NameEnglish string `json:"nameEnglish"`
}

// ListProvince handles GET /api/v1/provinces.
func (h *LocationHandler) ListProvince(c *gin.Context) {
	provinces, err := h.service.ListProvince(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "cannot list provinces"})
		return
	}

	out := make([]provinceDTO, 0, len(provinces))
	for _, p := range provinces {
		out = append(out, provinceDTO(p))
	}
	c.JSON(http.StatusOK, out)
}

// ListDistrictByProvince handles GET /api/v1/provinces/:provinceId/districts.
func (h *LocationHandler) ListDistrictByProvince(c *gin.Context) {
	provinceID, err := strconv.ParseInt(c.Param("provinceId"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "province id must be a number"})
		return
	}

	districts, err := h.service.ListDistrictByProvince(c.Request.Context(), provinceID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "cannot list districts"})
		return
	}

	out := make([]districtDTO, 0, len(districts))
	for _, d := range districts {
		out = append(out, districtDTO(d))
	}
	c.JSON(http.StatusOK, out)
}
