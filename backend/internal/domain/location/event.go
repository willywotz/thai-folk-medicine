package location

// ProvinceCreatedEvent is published after a province is created.
type ProvinceCreatedEvent struct {
	ProvinceID  int64
	NameThai    string
	NameEnglish string
}

// EventName identifies the event kind.
func (ProvinceCreatedEvent) EventName() string { return "province.created" }

// ProvinceUpdatedEvent is published after a province is updated.
type ProvinceUpdatedEvent struct {
	ProvinceID  int64
	NameThai    string
	NameEnglish string
}

// EventName identifies the event kind.
func (ProvinceUpdatedEvent) EventName() string { return "province.updated" }

// ProvinceDeletedEvent is published after a province is deleted.
type ProvinceDeletedEvent struct{ ProvinceID int64 }

// EventName identifies the event kind.
func (ProvinceDeletedEvent) EventName() string { return "province.deleted" }

// DistrictCreatedEvent is published after a district is created.
type DistrictCreatedEvent struct {
	DistrictID  int64
	ProvinceID  int64
	NameThai    string
	NameEnglish string
}

// EventName identifies the event kind.
func (DistrictCreatedEvent) EventName() string { return "district.created" }

// DistrictUpdatedEvent is published after a district is updated.
type DistrictUpdatedEvent struct {
	DistrictID  int64
	ProvinceID  int64
	NameThai    string
	NameEnglish string
}

// EventName identifies the event kind.
func (DistrictUpdatedEvent) EventName() string { return "district.updated" }

// DistrictDeletedEvent is published after a district is deleted.
type DistrictDeletedEvent struct{ DistrictID int64 }

// EventName identifies the event kind.
func (DistrictDeletedEvent) EventName() string { return "district.deleted" }
