# /// script
# requires-python = ">=3.13"
# dependencies = [
#     "click",
# ]
# ///
import click
import json
from pathlib import Path
from typing import Any, List, Tuple

def find_and_update_y_coords(obj: Any, height_diff: int, path: str = "") -> List[Tuple[str, int, int]]:
    """
    Recursively find and update all 'y' coordinates in a nested structure.

    Returns a list of tuples (path, old_value, new_value) for logging.
    """
    changes = []

    if isinstance(obj, dict):
        for key, value in obj.items():
            new_path = f"{path}.{key}" if path else key

            # If this key is 'y' and the value is a number, update it
            if key == 'y' and isinstance(value, (int, float)):
                old_value = value
                obj[key] = value + height_diff
                changes.append((new_path, old_value, obj[key]))
            # Otherwise, recurse into the value
            else:
                changes.extend(find_and_update_y_coords(value, height_diff, new_path))

    elif isinstance(obj, list):
        for i, item in enumerate(obj):
            new_path = f"{path}[{i}]"
            changes.extend(find_and_update_y_coords(item, height_diff, new_path))

    return changes

@click.command()
@click.argument("src", type=click.Path(exists=True))
@click.option("--height", type=int, required=True, help="New height for the map")
@click.option("--dry-run", is_flag=True, help="Show what would be changed without modifying the file")
def main(src, height, dry_run):
    """Adjust height of a map and shift all "y" coordinates accordingly.

    When the height increases, all Y coordinates are shifted down by the difference
    to maintain their relative position from the top of the map.
    When the height decreases, all Y coordinates are shifted up.
    """
    src_path = Path(src)

    # Read the JSON file
    with open(src_path, 'r') as f:
        data = json.load(f)

    # Get current height
    current_height = data.get('dimensions', {}).get('height', 0)
    if current_height == 0:
        click.echo(f"Error: No height found in {src_path}", err=True)
        return

    # Calculate the difference
    height_diff = height - current_height

    if height_diff == 0:
        click.echo(f"Height is already {height}, no changes needed.")
        return

    click.echo(f"Current height: {current_height}")
    click.echo(f"New height: {height}")
    click.echo(f"Height difference: {height_diff} (shifting Y coordinates {'down' if height_diff > 0 else 'up'} by {abs(height_diff)})")

    # Update the height first (we don't want to shift this!)
    data['dimensions']['height'] = height

    # Recursively find and update all Y coordinates
    # Skip the 'dimensions' section since we don't want to shift the height value itself
    changes = []
    for key, value in data.items():
        if key != 'dimensions':
            changes.extend(find_and_update_y_coords(value, height_diff, key))

    # Log all changes
    if changes:
        click.echo("\nChanges:")
        for path, old_val, new_val in sorted(changes):
            click.echo(f"  {path}: {old_val} => {new_val}")
    else:
        click.echo("\nNo Y coordinates found to update.")

    # Write the updated JSON back to file
    if not dry_run:
        with open(src_path, 'w') as f:
            json.dump(data, f, indent=2)
            f.write('\n')  # Add trailing newline
        click.echo(f"\n✓ Updated {src_path}")
    else:
        click.echo(f"\n(Dry run - no changes were made)")

if __name__ == "__main__":
    main()
