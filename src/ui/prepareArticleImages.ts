import { Image } from "react-native";
import { get, put } from "../data/store";
import { createArticleImagePreparer } from "./articleImages";

// Shared by the app and Android widget; geometry is resolved before publishing.
export const prepareArticleImages = createArticleImagePreparer({
  measure: uri => new Promise((resolve, reject) => {
    Image.getSize(uri, (width, height) => resolve({ width, height }), reject);
  }),
  read: () => get("ress.image-dimensions.v1", []),
  write: cache => put("ress.image-dimensions.v1", cache),
});
