

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Badge = require('../models/Badge');
const Category = require('../models/Category');
const { isAdmin } = require('../utils/permissions');
const { saveAttachment } = require('../utils/fileHandler');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('createbadge')
    .setDescription('Create a new badge (Team Only)')
    .addStringOption(option =>
      option.setName('name')
        .setDescription('Badge name')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('description')
        .setDescription('Badge description')
        .setRequired(true))
    .addAttachmentOption(option =>
      option.setName('image')
        .setDescription('Badge image file (PNG, JPG, GIF, WEBP)')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('category')
        .setDescription('Badge category name')
        .setRequired(true)),
  
  async execute(interaction) {
    if (!isAdmin(interaction.member)) {
      return interaction.reply({ 
        content: '❌ You do not have permission to use this command.', 
        ephemeral: true 
      });
    }

    await interaction.deferReply();

    const name = interaction.options.getString('name');
    const description = interaction.options.getString('description');
    const attachment = interaction.options.getAttachment('image');
    const categoryName = interaction.options.getString('category');

    // Validate image file
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'];
    if (!validTypes.includes(attachment.contentType)) {
      return interaction.editReply({ 
        content: '❌ Invalid image format! Please upload a PNG, JPG, GIF, or WEBP image.' 
      });
    }

    // Check file size (max 8MB)
    if (attachment.size > 8 * 1024 * 1024) {
      return interaction.editReply({ 
        content: '❌ Image file is too large! Maximum size is 8MB.' 
      });
    }

    try {
      // Check if badge already exists
      const existingBadge = await Badge.findOne({ name });
      if (existingBadge) {
        return interaction.editReply({ content: '❌ A badge with this name already exists!' });
      }

      // Find or create category
      let category = await Category.findOne({ name: categoryName });
      if (!category) {
        category = await Category.create({ name: categoryName });
      }

      // Save attachment locally
      const savedPath = await saveAttachment(attachment);

      // Create badge
      const badge = await Badge.create({
        name,
        description,
        imageUrl: savedPath, // Store local file path
        category: category._id,
        createdBy: interaction.user.id
      });

      const embed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle('✅ Badge Created Successfully!')
        .setThumbnail(attachment.url)
        .addFields(
          { name: '🏷️ Name', value: name, inline: true },
          { name: '📁 Category', value: categoryName, inline: true },
          { name: '📝 Description', value: description },
          { name: '🆔 Badge ID', value: badge._id.toString() }
        )
        .setTimestamp()
        .setFooter({ text: `Created by ${interaction.user.displayName}` });

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Error creating badge:', error);
      await interaction.editReply({ content: '❌ An error occurred while creating the badge.' });
    }
  }
};

