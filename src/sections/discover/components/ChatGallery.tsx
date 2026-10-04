import type { ChatMedia } from '../../../api/types';

type Img = NonNullable<ChatMedia['images']>[number];

/** Galería de imágenes moderadas que muestra el chat (search_images). */
export const ChatGallery = ({ images, onOpen }: { images: Img[]; onOpen: (img: Img) => void }) => (
  <div className="chat-gallery">
    {images.map((im) => (
      <button key={im.id} className="chat-img" title={im.title} onClick={() => onOpen(im)}>
        <img src={im.thumb} alt={im.title} referrerPolicy="no-referrer" loading="lazy" />
      </button>
    ))}
  </div>
);
