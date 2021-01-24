import * as fs from 'fs';
import { deserializeFile, isDuplicateKeyArray, isKvObject, KVObject, KVValue } from 'valve-kv';
import { AbilityKV, DifferentlyNamedAbilityKVs, abilityTypeMap, PropertyType } from "./interfaces";

class DotaKVCodemaker
{    
    code: string = "";
    indents: number = 1;

    constructor()
    {
        this.FetchFiles();
    }

    FetchFiles()
    {
        const fileLocation: string = "./input/"
        const abilities_filename = "npc_abilities_custom.txt";
        const override_filename = "npc_abilities_override.txt";
        const heroes_filename = "npc_heroes_custom.txt";
        const items_filename = "npc_items_custom.txt";
        const units_filename = "npc_units_custom.txt";

        // Get each of the files on the filepath
        // Checking for abilities filepath        
        if (fs.existsSync(fileLocation + abilities_filename))        
        {
            this.ReadAbilityFile(fileLocation, abilities_filename);
        }        
        
        // Do for the rest of the files.. later when they're properly defined :)
    }

    ReadAbilityFile(fileLocation: string, filename: string)
    {
        // Open the file and read all of it
        const ability_text = deserializeFile(fileLocation + filename);

        // Read each ability: key is ability name, values are its entire KV object        
        for (const [key, value] of Object.entries(ability_text["DOTAAbilities"] as KVObject)) 
        {   
            if (isKvObject(value))
            {
                this.ParseAbility(key, value);
            }
        }

        // Write to input file
        const outputPath = "./output/" + "abilities_custom_output.ts";        
        fs.writeFileSync(outputPath, this.code);
        console.log("Wrote ability codemaker file to " + outputPath);

        // Clear code for the next iterations
        this.code = "";
    }

    ParseAbility(ability_name: string, kvValues: KVObject)
    {
        this.AddLineToCode(this.indents++, "this.Abilities.push({");
        this.AddLineToCode(this.indents, `Name: "${ability_name}",`);

        // Read all KVs inside the ability
        for (const [key, value] of Object.entries(kvValues)) 
        {
            // Get actual key to match how the code expects it to look like
            const actual_key = this.GetExpectedKeyFromKV(key) ? this.GetExpectedKeyFromKV(key) : key;
            let actual_value: string = value.toString();
            const property_type = abilityTypeMap[actual_key];
            let text: string = "";

            // Boolean types
            switch (property_type) 
            {
                case PropertyType.Boolean:                    
                    // Parse as boolean
                    actual_value = value === '1' ? "true" : "false";
                    text = `${actual_key}: ${actual_value},`;                    
                    this.AddLineToCode(this.indents, text);
                    break;
            
                case PropertyType.Number:
                    // Parse as number
                    text = `${actual_key}: ${value},`;                    
                    this.AddLineToCode(this.indents, text);
                    break;

                case PropertyType.String:
                    // Parse as string
                    text = `${actual_key}: "${value}",`;                    
                    this.AddLineToCode(this.indents, text);
                    break;

                case PropertyType.AbilityBehaviorOrAbilityBehaviorArray:
                    // Parse as AbilityBehavior or AbilityBehavior array
                    actual_value = this.ConvertSingularOrArrayToCode(value, "|", /DOTA_ABILITY_BEHAVIOR_(\w+)/, "AbilityBehavior.$1");
                    text = `${actual_key}: ${actual_value},`;                   
                    this.AddLineToCode(this.indents, text);
                    break;

                case PropertyType.AbilityCastGestureSlotValue:
                    // Parse as AbilityCastGestureSlotValue
                    actual_value = "AbilityCastGestureSlotValue." + value.toString();
                    text = `${actual_key}: ${actual_value},`;                    
                    this.AddLineToCode(this.indents, text);                    
                    break;

                case PropertyType.AbilitySpecialBlockArray:
                    // Parse as ability special blocks object
                    this.AddLineToCode(this.indents, "AbilitySpecials:");
                    this.AddLineToCode(this.indents++, "[");
                    
                    for (const [abilty_special_num, ability_special_object] of Object.entries(value)) 
                    {
                        this.AddLineToCode(this.indents++, "{");

                        for (const [ability_special_field, ability_special_value] of Object.entries(ability_special_object)) 
                        {
                            if (ability_special_field === 'var_type')
                            {
                                text = `${ability_special_value}`.replace(/FIELD_(\w+)/, "$1").toUpperCase();
                                text = `VarType: VarTypes.${text},`;
                                this.AddLineToCode(this.indents, text);                                
                            }
                            else if (ability_special_field === 'LinkedSpecialBonus')
                            {
                                text = `LinkedSpecialBonus: "${ability_special_value}",`;
                                this.AddLineToCode(this.indents, text);                                
                            }
                            else if (ability_special_field === 'CalculateSpellDamageTooltip')
                            {
                                text = `CalculateSpellDamageTooltip: ${ability_special_value === '1' ? "true" : "false"},`;
                                this.AddLineToCode(this.indents, text);                                
                            }
                            else if (ability_special_field === `LinkedSpecialBonusField`)
                            {
                                text = `LinkedSpecialBonusField: "${ability_special_value}",`;
                                this.AddLineToCode(this.indents, text);                                
                            }
                            else if (ability_special_field === `LinkedSpecialBonusOperation`)
                            {
                                text = `LinkedSpecialBonusOperation: ${ability_special_value},`.replace(/SPECIAL_BONUS_(\w+)/, "LinkedSpecialBonusOperation.$1");
                                this.AddLineToCode(this.indents, text);                                
                            }
                            else if (ability_special_field === `RequiresScepter`)
                            {
                                text = `RequiresScepter: ${ability_special_value === '1' ? "true" : "false"},`;
                                this.AddLineToCode(this.indents, text);                                
                            }
                            else if (ability_special_field === 'levelkey')
                            {
                                // just ignore this shit, it's never going to work on a custom game anyway
                                continue;
                            }
                            else // Name-value ability special field
                            {
                                text = `Name: "${ability_special_field}",`
                                this.AddLineToCode(this.indents, text);                                
                                const ability_special_values = this.ConvertSingularOrArrayToCode(ability_special_value, " ");                                
                                text = `Values: ${ability_special_values != "" ? ability_special_values : 0},`;
                                this.AddLineToCode(this.indents, text);
                            }
                        }

                        this.AddLineToCode(--this.indents, "},", 2);
                    }

                    this.AddLineToCode(--this.indents, "],", 2);                    
                    break;

                case PropertyType.AbilityType:
                    // Parse as ability type
                    actual_value = value.toString().replace(/DOTA_ABILITY_TYPE_(\w+)/, "AbilityTypes.$1");
                    text = `${actual_key}: ${actual_value},`;                    
                    this.AddLineToCode(this.indents, text);                    
                    break;

                case PropertyType.DamageType:
                    // Parse as damage type
                    actual_value = value.toString().replace(/DAMAGE_TYPE_(\w+)/, "DamageType.$1");
                    text = `${actual_key}: ${actual_value},`;
                    this.AddLineToCode(this.indents, text);                    
                    break;

                case PropertyType.FightRecapLevel:
                    // Parse as Fight Recap Level
                    text = `${actual_key}: ${value},`;
                    this.AddLineToCode(this.indents, text);                    
                    break;

                case PropertyType.GameActivity:
                    // Parse as GameActivity
                    actual_value = value.toString().replace(/ACT_(\w+)/, "GameActivity.$1");
                    text = `${actual_key}: ${actual_value},`;
                    this.AddLineToCode(this.indents, text);                    
                    break;

                case PropertyType.NumberOrNumberArray:
                    // Parse as a number or a possible array of numbers
                    actual_value = this.ConvertSingularOrArrayToCode(value, " ");
                    text = `${actual_key}: ${actual_value},`;                    
                    this.AddLineToCode(this.indents, text);
                    break;

                case PropertyType.PrecacheKVArray:
                    // Parse as an array of Precache KV objects
                    this.AddLineToCode(this.indents, "Precache:");
                    this.AddLineToCode(this.indents++, "[");
                    
                    for (const [preacache_type, path] of Object.entries(value)) 
                    {
                        if (isDuplicateKeyArray(path))
                        {
                            for (const precache_path of path) 
                            {                                
                                this.AddLineToCode(this.indents++, "{");                                                
                                this.AddLineToCode(this.indents, `PrecacheType: PrecacheType.${preacache_type.toUpperCase()},`);
                                this.AddLineToCode(this.indents, `path: "${precache_path}",`);                                
                                this.AddLineToCode(--this.indents, "},", 2);
                            }
                        }
                        else
                        {
                            this.AddLineToCode(this.indents++, "{");                                                
                            this.AddLineToCode(this.indents, `PrecacheType: PrecacheType.${preacache_type.toUpperCase()},`);
                            this.AddLineToCode(this.indents, `path: "${path}",`);
                            this.AddLineToCode(--this.indents, "},", 2);
                        }

                    }

                    this.AddLineToCode(--this.indents, "],", 2);
                    break;

                case PropertyType.SpellDispellableTypes:
                    // Parse as possible Spell Dispeallable Types
                    actual_value = value.toString().replace(/SPELL_(\w+)/, "SpellDispellableTypes.$1");
                    text = `${actual_key}: ${actual_value},`;
                    this.AddLineToCode(this.indents, text);                    
                    break;

                case PropertyType.SpellImmunityTypes:
                    // Parse as Spell Immunity Type
                    actual_value = value.toString().replace(/SPELL_IMMUNITY_(\w+)/, "SpellImmunityTypes.$1");
                    text = `${actual_key}: ${actual_value},`;
                    this.AddLineToCode(this.indents, text);                    
                    break;

                case PropertyType.UnitTargetFlagsOrUnitTargetFlagsArray:
                    // Parse as UnitTargetFlag or an array of those
                    actual_value = this.ConvertSingularOrArrayToCode(value, "|", /DOTA_UNIT_TARGET_FLAG_(\w+)/, "UnitTargetFlags.$1");
                    text = `${actual_key}: ${actual_value},`;
                    this.AddLineToCode(this.indents, text);                    
                    break;

                case PropertyType.UnitTargetTeamOrUnitTargetTeamArray:
                    // Parse as UnitTargetTeam or an array of those
                    actual_value = this.ConvertSingularOrArrayToCode(value, "|", /DOTA_UNIT_TARGET_TEAM_(\w+)/, "UnitTargetTeam.$1");
                    text = `${actual_key}: ${actual_value},`;
                    this.AddLineToCode(this.indents, text);                    
                    break;

                case PropertyType.UnitTargetTypeOrUnitTargetTypeArray:
                    // Parse as UnitTargetType or an array of those
                    actual_value = this.ConvertSingularOrArrayToCode(value, "|", /DOTA_UNIT_TARGET_(\w+)/, "UnitTargetType.$1");
                    text = `${actual_key}: ${actual_value},`;
                    this.AddLineToCode(this.indents, text);                    
                    break;

                default:
                    // Doesn't belong to any of those. Either an error or an invalid value (Datadriven KVs are considered invalid)
                    break;
            }
        }

        this.AddLineToCode(--this.indents, "});", 2);
    }

    AddLineToCode(indents: number, text_to_add: string, newlines?: number)
    {
        // Defaults to 1 if omitted
        if (!newlines)
        {
            newlines = 1;
        }

        // Add indents
        for (let index = 0; index < indents; index++) 
        {            
            this.code += "\t";
        }

        // Add text
        this.code += text_to_add;

        // Add new lines
        for (let index = 0; index < newlines; index++)
        {
            this.code += "\n";
        }
    }

    ConvertSingularOrArrayToCode(value, seperator: string, regex?: RegExp, replace_text?: string): string
    {
        let values: string | string[];
        let actual_value = "";        
        if (value.toString().indexOf(seperator) != -1)
        {
            values = value.toString().split(seperator);
            actual_value = "[";
            for (let index = 0; index < values.length; index++) 
            {                            
                if (index > 0)
                {
                    actual_value += ", ";
                }

                let arrayValue = values[index];
                arrayValue = arrayValue.trim();
                actual_value += regex && replace_text ? arrayValue.replace(regex, replace_text) : arrayValue;                
            }

            actual_value += "]";
        }
        else
        {
            actual_value += regex && replace_text ? value.replace(regex, replace_text) : value;
        }

        return actual_value;
    }

    GetExpectedKeyFromKV(name: any): string | undefined
    {
        for (const key in DifferentlyNamedAbilityKVs)
        {
            if (DifferentlyNamedAbilityKVs[key] === name)
            {
                return key;
            }
        }
        return undefined;
    }
}

new DotaKVCodemaker();