#!/usr/bin/env python3
"""
Create simple PNG icons without requiring PIL
Creates minimal valid PNG files that Chrome will accept
"""

import struct
import zlib
import os

def create_simple_png(width, height, color_rgb, output_path):
    """
    Create a simple solid-color PNG file
    color_rgb: tuple of (r, g, b) values 0-255
    """
    # PNG signature
    png_signature = b'\x89PNG\r\n\x1a\n'
    
    # IHDR chunk (image header)
    ihdr_data = struct.pack('>IIBBBBB', width, height, 8, 2, 0, 0, 0)
    # 2 = RGB color type
    ihdr_chunk = create_chunk(b'IHDR', ihdr_data)
    
    # Create image data (RGB values for each pixel)
    r, g, b = color_rgb
    raw_data = b''
    for y in range(height):
        raw_data += b'\x00'  # Filter type (0 = none)
        for x in range(width):
            raw_data += bytes([r, g, b])
    
    # Compress the image data
    compressed_data = zlib.compress(raw_data, 9)
    idat_chunk = create_chunk(b'IDAT', compressed_data)
    
    # IEND chunk (end of file)
    iend_chunk = create_chunk(b'IEND', b'')
    
    # Write PNG file
    with open(output_path, 'wb') as f:
        f.write(png_signature)
        f.write(ihdr_chunk)
        f.write(idat_chunk)
        f.write(iend_chunk)
    
    print(f'Created {output_path} ({width}x{height})')

def create_chunk(chunk_type, data):
    """Create a PNG chunk"""
    length = struct.pack('>I', len(data))
    crc = struct.pack('>I', zlib.crc32(chunk_type + data) & 0xffffffff)
    return length + chunk_type + data + crc

def create_icon_with_design(width, height, output_path):
    """
    Create a more elaborate icon with a navigation symbol
    """
    # Background color (dark gray: #1f1f1f)
    bg_color = (31, 31, 31)
    # Accent color (Swagger blue: #61affe)
    accent_color = (97, 175, 254)
    
    # Create image data
    raw_data = b''
    
    # Calculate dimensions for the icon design
    padding = width // 8
    line_height = max(1, width // 20)
    line_spacing = width // 6
    start_x = width // 4
    end_x = width - width // 4
    center_y = height // 2
    
    for y in range(height):
        raw_data += b'\x00'  # Filter type
        for x in range(width):
            # Default to background color
            r, g, b = bg_color
            
            # Check if we're in the padding area (make it transparent by using background)
            if padding <= x < width - padding and padding <= y < height - padding:
                # Check if we're in one of the three horizontal lines
                if start_x <= x <= end_x:
                    # Top line
                    if abs(y - (center_y - line_spacing)) <= line_height // 2:
                        r, g, b = accent_color
                    # Middle line
                    elif abs(y - center_y) <= line_height // 2:
                        r, g, b = accent_color
                    # Bottom line
                    elif abs(y - (center_y + line_spacing)) <= line_height // 2:
                        r, g, b = accent_color
            
            raw_data += bytes([r, g, b])
    
    # Create PNG
    png_signature = b'\x89PNG\r\n\x1a\n'
    ihdr_data = struct.pack('>IIBBBBB', width, height, 8, 2, 0, 0, 0)
    ihdr_chunk = create_chunk(b'IHDR', ihdr_data)
    compressed_data = zlib.compress(raw_data, 9)
    idat_chunk = create_chunk(b'IDAT', compressed_data)
    iend_chunk = create_chunk(b'IEND', b'')
    
    with open(output_path, 'wb') as f:
        f.write(png_signature)
        f.write(ihdr_chunk)
        f.write(idat_chunk)
        f.write(iend_chunk)
    
    print(f'Created {output_path} ({width}x{height})')

# Create icons directory
os.makedirs('icons', exist_ok=True)

# Create icons with navigation design
print('Creating SwaggerNav icons...')
create_icon_with_design(16, 16, 'icons/icon16.png')
create_icon_with_design(48, 48, 'icons/icon48.png')
create_icon_with_design(128, 128, 'icons/icon128.png')

print('\n✓ Icons created successfully!')
print('The extension is ready to load in Chrome.')

