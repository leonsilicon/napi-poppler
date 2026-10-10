vcpkg_download_distfile(ARCHIVE
    URLS "https://poppler.freedesktop.org/poppler-data-${VERSION}.tar.gz"
    FILENAME "poppler-data-${VERSION}.tar.gz"
    SHA512 75f201e4c586ba47eb9a48a33ef6663fe353d0694b602feb7db282d73da7f0daffb0ff7e18e4a6cb40324305efa2413df562666939f4214e2dfd7ff00288f3de
)
vcpkg_extract_source_archive(SOURCE_PATH ARCHIVE "${ARCHIVE}")
file(INSTALL
    "${SOURCE_PATH}/cMap"
    "${SOURCE_PATH}/cidToUnicode"
    "${SOURCE_PATH}/nameToUnicode"
    "${SOURCE_PATH}/unicodeMap"
    DESTINATION "${CURRENT_PACKAGES_DIR}/share/poppler"
)
set(VCPKG_POLICY_EMPTY_PACKAGE enabled)
vcpkg_install_copyright(FILE_LIST "${SOURCE_PATH}/COPYING" "${SOURCE_PATH}/COPYING.adobe" "${SOURCE_PATH}/COPYING.gpl2")
