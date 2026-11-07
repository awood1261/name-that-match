# Authored capture fixtures

`sample.json` and `sample.png` were independently authored for import tests. They do not copy the Chrome extension or the user's capture collection. The PNG is a tiny noninterlaced 8-bit RGBA image (2 × 1 pixels, red and blue), encoded using standard PNG chunks, zlib and CRC32. The JSON describes that image using the approved v1 contract, omits optional title and includes an inert extra field.

Tests generate controlled variants in memory and store imports only under temporary roots. CRC32 is also checked against the independent `123456789` known vector. The fixture files remain unchanged by verification.
