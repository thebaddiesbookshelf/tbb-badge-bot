const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  AttachmentBuilder
} = require('discord.js');

const Badge = require('../models/Badge');
const Category = require('../models/Category');
const { isAdmin } = require('../utils/permissions');
const canvasGenerator = require('../utils/canvasGenerator');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('catalog')
    .setDescription('Browse every badge available in the server')
    .addStringOption(option =>
      option
        .setName('category')
        .setDescription('Filter the catalog by category')
        .setRequired(false)
        .setAutocomplete(true)
    ),

  async autocomplete(interaction) {
    try {
      const typedText = interaction.options.getFocused();

      const categories = await Category.find({
        name: {
          $regex: typedText,
          $options: 'i'
        }
      })
        .sort({ name: 1 })
        .limit(25)
        .lean();

      await interaction.respond(
        categories.map(category => ({
          name: category.name,
          value: category.name
        }))
      );
    } catch (error) {
      console.error(
        'Badge catalog autocomplete error:',
        error
      );

      if (!interaction.responded) {
        try {
          await interaction.respond([]);
        } catch {}
      }
    }
  },

  async execute(interaction) {
    if (!isAdmin(interaction.member)) {
      return interaction.reply({
        content:
          '❌ You do not have permission to use this command.',
        ephemeral: true
      });
    }

    await interaction.deferReply();

    try {
      const badges = await Badge.find()
        .populate('category')
        .sort({ name: 1 })
        .lean();

      if (badges.length === 0) {
        return interaction.editReply({
          content: 'No badges exist yet.'
        });
      }

      const allBadgeData = badges.map(badge => ({
        name: badge.name,
        imagePath: badge.imageUrl,
        description: badge.description,
        category:
          badge.category?.name ||
          'Uncategorized'
      }));

      const availableCategories = [
        ...new Set(
          allBadgeData.map(
            badge => badge.category
          )
        )
      ]
        .sort((a, b) =>
          a.localeCompare(b)
        )
        .slice(0, 24);

      const startingCategory =
        interaction.options.getString(
          'category'
        );

      let selectedCategory =
        startingCategory || 'All Badges';

      let currentPage = 1;

      const getFilteredBadges = () => {
        if (
          selectedCategory ===
          'All Badges'
        ) {
          return allBadgeData;
        }

        return allBadgeData.filter(
          badge =>
            badge.category.toLowerCase() ===
            selectedCategory.toLowerCase()
        );
      };


      const createNavigationRow = (
        pageNumber,
        totalPages
      ) =>
    new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('catalog_first')
      .setLabel('≪')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(
        pageNumber === 1
      ),

    new ButtonBuilder()
      .setCustomId(
        'catalog_previous'
      )
      .setLabel('↢')
      .setStyle(
        ButtonStyle.Secondary
      )
      .setDisabled(
        pageNumber === 1
      ),

    new ButtonBuilder()
      .setCustomId('catalog_done')
      .setLabel('♡ Done ♡')
      .setStyle(ButtonStyle.Primary),

    new ButtonBuilder()
      .setCustomId('catalog_next')
      .setLabel('↣')
      .setStyle(
        ButtonStyle.Secondary
      )
      .setDisabled(
        pageNumber === totalPages
      ),

    new ButtonBuilder()
      .setCustomId('catalog_last')
      .setLabel('≫')
      .setStyle(
        ButtonStyle.Secondary
      )
      .setDisabled(
        pageNumber === totalPages
      )
  );

      // Category dropdown.
      const createCategoryRow = () => {
        const options = [
          {
            label: 'All Badges',
            value: 'All Badges',
            description:
              'Browse the complete badge catalog',
            default:
              selectedCategory ===
              'All Badges'
          },

          ...availableCategories.map(
            category => ({
              label: category,
              value: category,
              description:
                `View ${category} badges`,
              default:
                selectedCategory ===
                category
            })
          )
        ];

        const selectMenu =
          new StringSelectMenuBuilder()
            .setCustomId(
              'catalog_category'
            )
            .setPlaceholder(
              'Choose a badge category'
            )
            .addOptions(options);

        return new ActionRowBuilder()
          .addComponents(selectMenu);
      };

      // Generate the current catalog page.
      const createPage = async (
        pageNumber
      ) => {
        const filteredBadges =
          getFilteredBadges();

        const totalPages =
          canvasGenerator
            .calculateCatalogPages(
              filteredBadges.length
            );

        currentPage = Math.max(
          1,
          Math.min(
            pageNumber,
            totalPages
          )
        );

        const start =
          (currentPage - 1) *
          canvasGenerator
            .catalogBadgesPerPage;

        const end =
          start +
          canvasGenerator
            .catalogBadgesPerPage;

        const pageBadges =
          filteredBadges.slice(
            start,
            end
          );

        const categoryName =
          selectedCategory ===
          'All Badges'
            ? null
            : selectedCategory;

        const imageBuffer =
          await canvasGenerator
            .generateCatalogPage(
              pageBadges,
              currentPage,
              totalPages,
              categoryName
            );

        const attachment =
          new AttachmentBuilder(
            imageBuffer,
            {
              name:
                'badge-catalog.png'
            }
          );

        const embed =
          new EmbedBuilder()
            .setColor('#FF1493')
            .setTitle(
              categoryName
                ? `౨ৎ ${categoryName} Badge Catalog`
                : '౨ৎ The Baddies Bookshelf Badge Catalog'
            )
            .setDescription(
              categoryName
                ? `Browsing all badges filed in the **${categoryName}** collection.`
                : 'Browse the official catalog of badges available throughout The Baddies Bookshelf.'
            )
            .setImage(
              'attachment://badge-catalog.png'
            )
            .setFooter({
              text:
                `Catalog page ${currentPage} of ${totalPages}` +
                ` • ${filteredBadges.length} badge${
                  filteredBadges.length ===
                  1
                    ? ''
                    : 's'
                }`
            })
            .setTimestamp();

        return {
          embed,
          attachment,
          totalPages,
          navigationRow:
            createNavigationRow(
              currentPage,
              totalPages
            ),
          categoryRow:
            createCategoryRow()
        };
      };

      // Validate slash-command category, if one was supplied.
      if (
        selectedCategory !==
          'All Badges' &&
        !allBadgeData.some(
          badge =>
            badge.category.toLowerCase() ===
            selectedCategory.toLowerCase()
        )
      ) {
        return interaction.editReply({
          content:
            `No badges were found in the **${selectedCategory}** category.`
        });
      }

      if (
        selectedCategory !==
        'All Badges'
      ) {
        const matchingCategory =
          availableCategories.find(
            category =>
              category.toLowerCase() ===
              selectedCategory.toLowerCase()
          );

        if (matchingCategory) {
          selectedCategory =
            matchingCategory;
        }
      }

      const firstPage =
        await createPage(
          currentPage
        );

      const message =
        await interaction.editReply({
          embeds: [
            firstPage.embed
          ],
          files: [
            firstPage.attachment
          ],
          components: [
            firstPage.navigationRow,
            firstPage.categoryRow
          ]
        });

      const collector =
        message
          .createMessageComponentCollector({
            time: 300000,
            idle: 60000
          });

      collector.on(
        'collect',
        async componentInteraction => {
          if (
            componentInteraction
              .user.id !==
            interaction.user.id
          ) {
            return componentInteraction
              .reply({
                content:
                  '❌ These controls belong to the person who opened the catalog.',
                ephemeral: true
              });
          }

          if (
  componentInteraction.customId ===
  'catalog_done'
) {
  await componentInteraction.update({
    components: []
  });

  collector.stop('done');
  return;
}

          if (
            componentInteraction
              .customId ===
            'catalog_category'
          ) {
            selectedCategory =
              componentInteraction
                .values[0];

            currentPage = 1;
          }

          if (
            componentInteraction
              .customId ===
            'catalog_first'
          ) {
            currentPage = 1;
          }

          if (
            componentInteraction
              .customId ===
            'catalog_previous'
          ) {
            currentPage--;
          }

          if (
            componentInteraction
              .customId ===
            'catalog_next'
          ) {
            currentPage++;
          }

          if (
            componentInteraction
              .customId ===
            'catalog_last'
          ) {
            const filteredBadges =
              getFilteredBadges();

            currentPage =
              canvasGenerator
                .calculateCatalogPages(
                  filteredBadges.length
                );
          }

          const updatedPage =
            await createPage(
              currentPage
            );

          await componentInteraction
            .update({
              embeds: [
                updatedPage.embed
              ],
              files: [
                updatedPage.attachment
              ],
              attachments: [],
              components: [
                updatedPage
                  .navigationRow,
                updatedPage
                  .categoryRow
              ]
            });
        }
      );

      collector.on(
  'end',
  async (_, reason) => {
    if (reason === 'done') {
      return;
    }

    await message
      .edit({
        components: []
      })
      .catch(() => {});
  }
);
    } catch (error) {
      console.error(
        'Error fetching badge catalog:',
        error
      );

      await interaction.editReply({
        content:
          '❌ An error occurred while opening the badge catalog.'
      });
    }
  }
};