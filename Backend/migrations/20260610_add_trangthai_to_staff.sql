ALTER TABLE BAC_SI
ADD COLUMN TrangThai VARCHAR(30) NOT NULL DEFAULT 'Đang hoạt động';

ALTER TABLE LE_TAN
ADD COLUMN TrangThai VARCHAR(30) NOT NULL DEFAULT 'Đang hoạt động';

ALTER TABLE XET_NGHIEM_VIEN
ADD COLUMN TrangThai VARCHAR(30) NOT NULL DEFAULT 'Đang hoạt động';

UPDATE BAC_SI
SET TrangThai = 'Đang hoạt động'
WHERE TrangThai IS NULL OR TrangThai = '';

UPDATE LE_TAN
SET TrangThai = 'Đang hoạt động'
WHERE TrangThai IS NULL OR TrangThai = '';

UPDATE XET_NGHIEM_VIEN
SET TrangThai = 'Đang hoạt động'
WHERE TrangThai IS NULL OR TrangThai = '';
