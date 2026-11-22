// Platzhalter: Der meshopt-Decoder ist im App-Bundle enthalten (assets/meshopt.ts) und als globales
// MeshoptDecoder gesetzt. Babylon lädt dieses Skript nur, um den Decoder zu „finden“ – so entsteht
// keine Anfrage an ein CDN.

self.__kcMeshoptShim = true;
