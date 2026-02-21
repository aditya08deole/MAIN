"""
Seed script for pipelines table.
Inserts water supply and borewell pipeline data from reference files.
"""
import asyncio
import sys
import json
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession
from database import engine
from models import Pipeline
import uuid

# Pipeline data extracted from pipelines.html
PIPELINES_DATA = [
    # Water Supply Pipelines (Blue #00b4d8)
    {
        "name": "PH2 - OBH/PALASH",
        "pipeline_type": "water_supply",
        "coordinates": [[78.3492569095647, 17.446057476630784], [78.34825099866276, 17.445482194972044], [78.34720892666434, 17.44630656687505], [78.34598638379146, 17.445050104381707]],
        "color": "#00b4d8",
        "diameter": "6 inch",
        "material": "PVC",
        "installation_type": "Underground",
        "status": "Flowing"
    },
    {
        "name": "PH2 - KADAMBA/NBH",
        "pipeline_type": "water_supply",
        "coordinates": [[78.34717428867077, 17.4468858335199], [78.34687317239377, 17.446583646976833], [78.34721168790577, 17.446302774851645]],
        "color": "#00b4d8",
        "diameter": "4 inch",
        "material": "PVC",
        "installation_type": "Underground",
        "status": "Flowing"
    },
    {
        "name": "PH2 - HIMALAYA",
        "pipeline_type": "water_supply",
        "coordinates": [[78.34925379742043, 17.44605617669069], [78.34908273787016, 17.445883817839018], [78.34973473021046, 17.44532883606179], [78.3496616935484, 17.44524815714857]],
        "color": "#00b4d8",
        "diameter": "6 inch",
        "material": "GI",
        "installation_type": "Surface",
        "status": "Flowing"
    },
    {
        "name": "PH2 - VINDYA",
        "pipeline_type": "water_supply",
        "coordinates": [[78.349258777606, 17.446050296030123], [78.34973190965451, 17.44566149363318]],
        "color": "#00b4d8",
        "diameter": "4 inch",
        "material": "PVC",
        "installation_type": "Underground",
        "status": "Flowing"
    },
    {
        "name": "PH2 - PARIJAT/NGH",
        "pipeline_type": "water_supply",
        "coordinates": [[78.34924741075247, 17.446051955076115], [78.34798068042636, 17.447117930045437], [78.34812314046127, 17.447270012848705], [78.34779469227817, 17.447551631476756]],
        "color": "#00b4d8",
        "diameter": "6 inch",
        "material": "PVC",
        "installation_type": "Underground",
        "status": "Flowing"
    },
    {
        "name": "PH1 - PH3",
        "pipeline_type": "water_supply",
        "coordinates": [[78.35156809621168, 17.445565496370946], [78.3510818505751, 17.445402935739253], [78.34871393327182, 17.44297366973413]],
        "color": "#00b4d8",
        "diameter": "6 inch",
        "material": "GI",
        "installation_type": "Primary Supply",
        "status": "Flowing"
    },
    {
        "name": "PH3 - BLOCK B",
        "pipeline_type": "water_supply",
        "coordinates": [[78.3486649229556, 17.443007256799305], [78.34880425711145, 17.443140183708365], [78.34848826715137, 17.443396542473252]],
        "color": "#00b4d8",
        "diameter": "1.5 inch",
        "material": "GI",
        "installation_type": "Gate Valves",
        "status": "Flowing"
    },
    {
        "name": "PH3 - BLOCK A",
        "pipeline_type": "water_supply",
        "coordinates": [[78.3484335287335, 17.44398521679085], [78.34908292542195, 17.44341553199783], [78.34880425711145, 17.443140183708365]],
        "color": "#00b4d8",
        "diameter": "1.5 inch",
        "material": "GI",
        "installation_type": "Gate Valves",
        "status": "Flowing"
    },
    {
        "name": "PH1 - PH4",
        "pipeline_type": "water_supply",
        "coordinates": [[78.35159848364157, 17.44557532910399], [78.35095289614935, 17.44576982116662], [78.34859125482501, 17.447747056552885], [78.34890811607835, 17.448093307337402]],
        "color": "#00b4d8",
        "diameter": "6 inch",
        "material": "GI",
        "installation_type": "Primary Supply",
        "status": "Flowing"
    },
    {
        "name": "PH4 - BAKUL OHT",
        "pipeline_type": "water_supply",
        "coordinates": [[78.34889099161575, 17.4481030150547], [78.34863663284784, 17.44782419439771], [78.34842828429481, 17.448006849815854]],
        "color": "#00b4d8",
        "diameter": "4 inch",
        "material": "GI",
        "installation_type": "Surface/Overhead",
        "status": "Flowing"
    },
    {
        "name": "PH4 - NWH Block C",
        "pipeline_type": "water_supply",
        "coordinates": [[78.34863200557686, 17.447827892848082], [78.34798863298869, 17.44714473747763], [78.34746274583108, 17.44761440706972]],
        "color": "#00b4d8",
        "diameter": "4 inch",
        "material": "PVC",
        "installation_type": "Underground",
        "status": "Flowing"
    },
    {
        "name": "PH4 - NWH Block B",
        "pipeline_type": "water_supply",
        "coordinates": [[78.34798944843249, 17.44714716987866], [78.34775073198728, 17.446898400205413], [78.3472021023727, 17.447350593243257]],
        "color": "#00b4d8",
        "diameter": "4 inch",
        "material": "PVC",
        "installation_type": "Underground",
        "status": "Flowing"
    },
    {
        "name": "PH4 - NWH Block A",
        "pipeline_type": "water_supply",
        "coordinates": [[78.34774710095786, 17.44689799488779], [78.34744051382114, 17.44658242120913], [78.346897993527019, 17.44704423616315]],
        "color": "#00b4d8",
        "diameter": "4 inch",
        "material": "PVC",
        "installation_type": "Underground",
        "status": "Flowing"
    },
    {
        "name": "PH1 - PH2",
        "pipeline_type": "water_supply",
        "coordinates": [[78.34925227266547, 17.44607018219577], [78.34983216194138, 17.446702074561657]],
        "color": "#00b4d8",
        "diameter": "6 inch",
        "material": "GI",
        "installation_type": "Primary Supply",
        "status": "Flowing"
    },
    
    # Borewell Water Pipelines (Red #d62828)
    {
        "name": "pipe-p5-s1",
        "pipeline_type": "borewell_water",
        "coordinates": [[78.349013, 17.447797], [78.349042, 17.448091]],
        "color": "#d62828",
        "diameter": "2 inch",
        "material": "GI",
        "installation_type": "P5 to S1",
        "status": "Active"
    },
    {
        "name": "pipe-p5-s7",
        "pipeline_type": "borewell_water",
        "coordinates": [[78.349018, 17.447780], [78.349951, 17.446921], [78.349090, 17.445962]],
        "color": "#d62828",
        "diameter": "2 inch",
        "material": "GI",
        "installation_type": "P5 to S7",
        "status": "Active"
    },
    {
        "name": "pipe-p8-s2",
        "pipeline_type": "borewell_water",
        "coordinates": [[78.345291, 17.445120], [78.346206, 17.444911]],
        "color": "#d62828",
        "diameter": "2 inch",
        "material": "GI",
        "installation_type": "P8 to S2",
        "status": "Active"
    },
    {
        "name": "pipe-p9-s3",
        "pipeline_type": "borewell_water",
        "coordinates": [[78.346714, 17.446868], [78.346915, 17.446715], [78.346984, 17.446715]],
        "color": "#d62828",
        "diameter": "2 inch",
        "material": "GI",
        "installation_type": "Bore Water P9 to S3",
        "status": "Active"
    },
    {
        "name": "pipe-p10-s5",
        "pipeline_type": "borewell_water",
        "coordinates": [[78.350157, 17.443927], [78.349693, 17.444322], [78.350068, 17.444701]],
        "color": "#d62828",
        "diameter": "2 inch",
        "material": "GI",
        "installation_type": "Bore Water P10 to S5",
        "status": "Active"
    },
    {
        "name": "pipe-p1-p2",
        "pipeline_type": "borewell_water",
        "coordinates": [[78.348117, 17.443394], [78.348936, 17.443093]],  # Approximate coordinates
        "color": "#d62828",
        "diameter": "N/A",
        "material": "N/A",
        "installation_type": "P1 to P2",
        "status": "Active"
    }
]


async def seed_pipelines():
    """Seed pipelines into database."""
    print("[SEED] Starting pipeline seed...")
    print(f"[SEED] Total pipelines to insert: {len(PIPELINES_DATA)}")
    
    async with engine.begin() as conn:
        # Get existing pipeline names
        result = await conn.execute(text("SELECT name FROM pipelines"))
        existing_names = {row[0] for row in result}
        
        inserted_count = 0
        updated_count = 0
        
        for pipeline_data in PIPELINES_DATA:
            name = pipeline_data['name']
            
            if name in existing_names:
                # Update existing
                await conn.execute(
                    text("""
                        UPDATE pipelines
                        SET pipeline_type = :pipeline_type,
                            coordinates = :coordinates,
                            color = :color,
                            diameter = :diameter,
                            material = :material,
                            installation_type = :installation_type,
                            status = :status,
                            is_active = TRUE,
                            updated_at = NOW()
                        WHERE name = :name
                    """),
                    {
                        "name": name,
                        "pipeline_type": pipeline_data['pipeline_type'],
                        "coordinates": json.dumps(pipeline_data['coordinates']),
                        "color": pipeline_data['color'],
                        "diameter": pipeline_data.get('diameter'),
                        "material": pipeline_data.get('material'),
                        "installation_type": pipeline_data.get('installation_type'),
                        "status": pipeline_data['status']
                    }
                )
                updated_count += 1
                print(f"✓ Updated: {name}")
            else:
                # Insert new
                await conn.execute(
                    text("""
                        INSERT INTO pipelines (id, name, pipeline_type, coordinates, color, diameter, material, installation_type, status, is_active, created_by)
                        VALUES (:id, :name, :pipeline_type, :coordinates, :color, :diameter, :material, :installation_type, :status, TRUE, 'dev-bypass-id-admin@evara.com')
                    """),
                    {
                        "id": str(uuid.uuid4()),
                        "name": name,
                        "pipeline_type": pipeline_data['pipeline_type'],
                        "coordinates": json.dumps(pipeline_data['coordinates']),
                        "color": pipeline_data['color'],
                        "diameter": pipeline_data.get('diameter'),
                        "material": pipeline_data.get('material'),
                        "installation_type": pipeline_data.get('installation_type'),
                        "status": pipeline_data['status']
                    }
                )
                inserted_count += 1
                print(f"✓ Inserted: {name}")
        
        # Verify final count
        result = await conn.execute(text("SELECT COUNT(*) FROM pipelines WHERE is_active = TRUE"))
        total_count = result.scalar()
        
        print(f"\n[SEED] Complete!")
        print(f"  - Inserted: {inserted_count} pipelines")
        print(f"  - Updated: {updated_count} pipelines")
        print(f"  - Total: {inserted_count + updated_count} pipelines")
        print(f"  - Active pipelines in database: {total_count}")


if __name__ == "__main__":
    asyncio.run(seed_pipelines())
