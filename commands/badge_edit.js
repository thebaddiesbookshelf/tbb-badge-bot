

const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const Badge = require('../models/Badge');
const Category = require('../models/Category');
const { isAdmin } = require('../utils/permissions');
const { saveAttachment, getBadgeImagePath } = require('../utils/fileHandler');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('editbadge')
    .setDescription('Edit an existing badge (Team Only)')
    .addStringOption(option =>
      option.setName('name')
        .setDescription('Current badge name to edit')
        .setRequired(true)
        .setAutocomplete(true))
    .addStringOption(option =>
      option.setName('new_name')
        .setDescription('New badge name')
        .setRequired(false))
    .addStringOption(option =>
      option.setName('new_description')
        .setDescription('New badge description')
        .setRequired(false))
    .addAttachmentOption(option =>
      option.setName('new_image')
        .setDescription('New badge image file')
        .setRequired(false))
    .addStringOption(option =>
      option.setName('new_category')
        .setDescription('New badge category name')
        .setRequired(false)
        .setAutocomplete(true)),

  async autocomplete(interaction) {
    try {
      const focusedOption = interaction.options.getFocused(true);
      const typedText = focusedOption.value;

      if (focusedOption.name === 'name') {
        const badges = await Badge.find({
          name: { $regex: typedText, $options: 'i' }
        })
          .sort({ name: 1 })
          .limit(25)
          .lean();

        return interaction.respond(
          badges.map(badge => ({
            name: badge.name,
            value: badge.name
          }))
        );
      }

      if (focusedOption.name === 'new_category') {
        const categories = await Category.find({
          name: { $regex: typedText, $options: 'i' }
        })
          .sort({ name: 1 })
          .limit(25)
          .lean();

        return interaction.respond(
          categories.map(category => ({
            name: category.name,
            value: category.name
          }))
        );
      }

      return interaction.respond([]);
    } catch (error) {
      console.error('Badge edit autocomplete error:', error);

      if (!interaction.responded) {
        await interaction.respond([]);
      }
    }
  },

  async execute(interaction) {
    if (!isAdmin(interaction.member)) {
      return interaction.reply({
        content: '❌ You do not have permission to use this command.',
        ephemeral: true
      });
    }

    await interaction.deferReply();

    const currentName = interaction.options.getString('name');
    const newName = interaction.options.getString('new_name');
    const newDescription = interaction.options.getString('new_description');
    const newImage = interaction.options.getAttachment('new_image');
    const newCategoryName = interaction.options.getString('new_category');

    if (!newName && !newDescription && !newImage && !newCategoryName) {
      return interaction.editReply({
        content: '❌ You must provide at least one field to update!'
      });
    }

    try {
      const badge = await Badge.findOne({ name: currentName }).populate('category');

      if (!badge) {
        return interaction.editReply({ content: '❌ Badge not found!' });
      }

      const updates = {};

      if (newName) {
        const existingBadge = await Badge.findOne({ name: newName });

        if (
          existingBadge &&
          existingBadge._id.toString() !== badge._id.toString()
        ) {
          return interaction.editReply({
            content: '❌ A badge with this name already exists!'
          });
        }

        updates.name = newName;
      }

      if (newDescription) {
        updates.description = newDescription;
      }

      if (newImage) {
        const validTypes = [
          'image/png',
          'image/jpeg',
          'image/jpg',
          'image/gif',
          'image/webp'
        ];

        if (!validTypes.includes(newImage.contentType)) {
          return interaction.editReply({
            content: '❌ Invalid image format! Please upload a PNG, JPG, GIF, or WEBP image.'
          });
        }

        if (newImage.size > 8 * 1024 * 1024) {
          return interaction.editReply({
            content: '❌ Image file is too large! Maximum size is 8MB.'
          });
        }

        const savedPath = await saveAttachment(newImage);
        updates.imageUrl = savedPath;
      }

      if (newCategoryName) {
        let category = await Category.findOne({ name: newCategoryName });

        if (!category) {
          category = await Category.create({ name: newCategoryName });
        }

        updates.category = category._id;
      }

      await Badge.findByIdAndUpdate(badge._id, updates);

      const updatedBadge = await Badge.findById(badge._id).populate('category');

      const imagePath = getBadgeImagePath(updatedBadge.imageUrl);
      const imageAttachment = new AttachmentBuilder(imagePath, {
        name: 'badge.png'
      });

      const embed = new EmbedBuilder()
        .setColor('#FFA500')
        .setTitle('✏️ Badge Updated Successfully!')
        .setThumbnail('attachment://badge.png')
        .addFields(
          { name: '🏷️ Name', value: updatedBadge.name, inline: true },
          { name: '📁 Category', value: updatedBadge.category.name, inline: true },
          { name: '📝 Description', value: updatedBadge.description }
        )
        .setTimestamp()
        .setFooter({ text: `Updated by ${interaction.user.displayName}` });

      await interaction.editReply({
        embeds: [embed],
        files: [imageAttachment]
      });
    } catch (error) {
      console.error('Error editing badge:', error);

      await interaction.editReply({
        content: '❌ An error occurred while editing the badge.'
      });
    }
  }
};

