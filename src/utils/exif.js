// JPEG 사진의 EXIF에서 촬영 시각(DateTimeOriginal, 없으면 DateTime)을 읽는다.
// JPEG가 아니거나 메타데이터가 없으면 null. (iOS는 앨범 사진을 넘길 때 EXIF를 지우는 경우가 있음)

export async function readPhotoTakenAt(file) {
    try {
        // EXIF(APP1)는 파일 앞부분에 있으므로 앞 256KB만 읽는다
        const view = new DataView(await file.slice(0, 256 * 1024).arrayBuffer());
        if (view.getUint16(0) !== 0xffd8) return null;
        let offset = 2;
        while (offset + 10 <= view.byteLength) {
            const marker = view.getUint16(offset);
            if ((marker & 0xff00) !== 0xff00 || marker === 0xffda) break; // 이미지 데이터 시작 → 메타데이터 없음
            if (marker === 0xffe1 && view.getUint32(offset + 4) === 0x45786966) { // "Exif"
                return sanitize(parseExifDate(view, offset + 10));
            }
            offset += 2 + view.getUint16(offset + 2);
        }
    } catch {
        // 깨진 메타데이터는 무시하고 촬영 시각 없음으로 처리
    }
    return null;
}

function parseExifDate(view, tiff) {
    const little = view.getUint16(tiff) === 0x4949; // "II" = little endian
    const u16 = (o) => view.getUint16(o, little);
    const u32 = (o) => view.getUint32(o, little);
    const findTag = (ifd, tag) => {
        const count = u16(ifd);
        for (let i = 0; i < count; i++) {
            const entry = ifd + 2 + i * 12;
            if (u16(entry) === tag) return entry;
        }
        return null;
    };
    const readAscii = (entry) => {
        const len = u32(entry + 4);
        const start = len > 4 ? tiff + u32(entry + 8) : entry + 8;
        let s = '';
        for (let i = 0; i < len - 1; i++) s += String.fromCharCode(view.getUint8(start + i));
        return s;
    };

    const ifd0 = tiff + u32(tiff + 4);
    let raw = null;
    const exifPtr = findTag(ifd0, 0x8769);
    if (exifPtr) {
        const original = findTag(tiff + u32(exifPtr + 8), 0x9003);
        if (original) raw = readAscii(original);
    }
    if (!raw) {
        const modified = findTag(ifd0, 0x0132);
        if (modified) raw = readAscii(modified);
    }

    // "YYYY:MM:DD HH:MM:SS" (기기 현지 시각)
    const m = /^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/.exec(raw || '');
    if (!m) return null;
    return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
}

// 카메라 시계가 틀어진 사진 등 말이 안 되는 시각은 버린다
function sanitize(date) {
    if (!date || Number.isNaN(date.getTime())) return null;
    if (date.getFullYear() < 2000 || date.getTime() > Date.now() + 24 * 60 * 60 * 1000) return null;
    return date;
}
