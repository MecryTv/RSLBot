const {
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    MediaGalleryBuilder,
    ThumbnailBuilder,
    SectionBuilder
} = require("discord.js");

function ComponentV2Container(titleContent, textContent, thumbnailImageURL, mediaGalleryItems = []) {
    const title = new TextDisplayBuilder().setContent(titleContent);
    const text = new TextDisplayBuilder().setContent(textContent);
    const thumbnail = new ThumbnailBuilder().setURL(thumbnailImageURL);

    const separator1 = new SeparatorBuilder();
    const separator2 = new SeparatorBuilder();
    const spacer = new TextDisplayBuilder().setContent('\u200B');

    const section = new SectionBuilder()
        .addTextDisplayComponents(text)
        .setThumbnailAccessory(thumbnail);

    const container = new ContainerBuilder()
        .addTextDisplayComponents(title)
        .addSeparatorComponents(separator1)
        .addTextDisplayComponents(spacer)
        .addSectionComponents(section);

    if (mediaGalleryItems && mediaGalleryItems.length > 0) {
        const mediaGallery = new MediaGalleryBuilder();

        const formattedItems = mediaGalleryItems.map(url => ({
            media: {
                url: url
            }
        }));

        mediaGallery.addItems(formattedItems);

        container.addSeparatorComponents(separator2);
        container.addMediaGalleryComponents(mediaGallery);
    }

    return container;
}

module.exports = ComponentV2Container;