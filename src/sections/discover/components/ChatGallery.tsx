import type { ChatMedia } from '../../../api/types';

type Img = NonNullable<ChatMedia['images']>[number];

/** Las imágenes moderadas que muestra el chat (search_images), en la grilla de 3 del grupo «Imágenes». */
export const ChatGallery = ({ images, onOpen }: { images: Img[]; onOpen: (img: Img) => void }) => (
  <div className="mg-imgs">
    {images.map((im) => (
      <button type="button" key={im.id} className="mg-img" title={im.title} onClick={() => onOpen(im)}>
        <img src={im.thumb} alt={im.title} referrerPolicy="no-referrer" loading="lazy" />
      </button>
    ))}
  </div>
);
