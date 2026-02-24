import * as vscode from 'vscode';
import axios from 'axios';

export async function generateFabricMod(workspaceUri: vscode.Uri, data: any) {
    try {
        vscode.window.showInformationMessage(`Fetching latest Fabric mappings for Minecraft ${data.mcVersion}...`);

        // 1. Fetching Versions metadata
        const loaderRes = await axios.get('https://meta.fabricmc.net/v2/versions/loader');
        const loaderVersion = loaderRes.data[0].version;

        const loomVersion = "1.9-SNAPSHOT"; // Fallback latest loom

        let yarnVersion = "";
        if (!data.mojangMappings) {
            const yarnRes = await axios.get(`https://meta.fabricmc.net/v2/versions/yarn/${data.mcVersion}`);
            if (yarnRes.data.length > 0) {
                yarnVersion = yarnRes.data[0].version;
            } else {
                throw new Error(`Yarn mappings not found for version ${data.mcVersion}. Try checking 'Mojang Mappings'.`);
            }
        }

        let fabricApiVersion = "";
        const apiRes = await axios.get('https://meta.fabricmc.net/v2/versions/fabric-api');
        // Simple heuristic: trying to find first api match. Or we can just use a standard one.
        // Fabric API versions look like "0.100.8+1.21.1"
        const matchedApi = apiRes.data.find((v: any) => v.version.includes(data.mcVersion));
        if (matchedApi) {
            fabricApiVersion = matchedApi.version;
        } else {
            fabricApiVersion = apiRes.data[0].version; // fall back
        }

        // Folder structure configuration
        const write = async (filePath: string, content: string) => {
            const uri = vscode.Uri.joinPath(workspaceUri, filePath);
            await vscode.workspace.fs.writeFile(uri, Buffer.from(content, 'utf8'));
        };

        const createDir = async (dirPath: string) => {
            const uri = vscode.Uri.joinPath(workspaceUri, dirPath);
            await vscode.workspace.fs.createDirectory(uri);
        };

        const modid = data.packageName.split('.').pop()?.toLowerCase();
        if (!modid) throw new Error("Invalid package name for ModID");
        const className = data.projectName.replace(/[^a-zA-Z0-9]/g, '');

        vscode.window.showInformationMessage(`Scaffolding Fabric mod: ${data.projectName}...`);

        // 2. gradle.properties
        let gradleProps = `org.gradle.jvmargs=-Xmx3G
org.gradle.daemon=false
org.gradle.parallel=true

# Dependencies
minecraft_version=${data.mcVersion}
loader_version=${loaderVersion}
fabric_version=${fabricApiVersion}
`;
        if (!data.mojangMappings) {
            gradleProps += `yarn_mappings=${yarnVersion}\n`;
        }
        if (data.kotlinLang) {
            gradleProps += `kotlin_loader_version=1.12.0+kotlin.2.0.20\n`;
        }
        await write('gradle.properties', gradleProps);

        // 3. settings.gradle
        await write('settings.gradle', `rootProject.name = '${data.projectName}'\n`);

        // 4. build.gradle
        let buildGradle = `plugins {
    id 'fabric-loom' version '${loomVersion}'
    id 'maven-publish'
${data.kotlinLang ? `    id "org.jetbrains.kotlin.jvm" version "2.0.20"\n` : ''}
}

version = "${data.modVersion}"
group = "${data.packageName}"

base {
    archivesName = "${data.projectName.toLowerCase()}"
}

repositories {
    // Add repositories for dependencies, e.g. JEI, REI, etc.
}

dependencies {
    // To change the versions see the gradle.properties file
    minecraft "com.mojang:minecraft:\${project.minecraft_version}"
    ${data.mojangMappings ? 'mappings loom.officialMojangMappings()' : 'mappings "net.fabricmc:yarn:${project.yarn_mappings}:v2"'}
    
    modImplementation "net.fabricmc:fabric-loader:\${project.loader_version}"

    // Fabric API. This is technically optional, but you probably want it anyway.
    modImplementation "net.fabricmc.fabric-api:fabric-api:\${project.fabric_version}"
    
${data.kotlinLang ? `    modImplementation "net.fabricmc:fabric-language-kotlin:\${project.kotlin_loader_version}"\n` : ''}
}

processResources {
    inputs.property "version", project.version
    inputs.property "minecraft_version", project.minecraft_version
    inputs.property "loader_version", project.loader_version
    filteringCharset "UTF-8"

    filesMatching("fabric.mod.json") {
        expand "version": project.version,
                "minecraft_version": project.minecraft_version,
                "loader_version": project.loader_version
    }
}

def targetJavaVersion = ${data.javaVersion.replace('Java ', '')}
tasks.withType(JavaCompile).configureEach {
    // ensure that the encoding is set to UTF-8, no matter what the system default is
    // this fixes some edge cases with special characters not displaying correctly
    // see http://yodaconditions.net/blog/fix-for-java-file-encoding-problems-with-gradle.html
    // If Javadoc is generated, this must be specified in that task too.
    it.options.encoding = "UTF-8"
    if (targetJavaVersion >= 10 || JavaVersion.current().isJava11Compatible()) {
        it.options.release.set(targetJavaVersion)
    }
}

java {
    def javaVersion = JavaVersion.toVersion(targetJavaVersion)
    if (JavaVersion.current() < javaVersion) {
        toolchain.languageVersion = JavaLanguageVersion.of(targetJavaVersion)
    }
    // Loom will automatically attach sourcesJar to a RemapSourcesJar task and to the "build" task
    withSourcesJar()
}

jar {
    from("LICENSE") {
        rename { "\${it}_\${project.base.archivesName.get()}"}
    }
}

// configure the maven publication
publishing {
    publications {
        create("mavenJava", MavenPublication) {
            artifactId = project.base.archivesName.get()
            from components.java
        }
    }
    repositories {
        // Add repositories to publish to here.
    }
}
`;

        if (data.dataGen) {
            buildGradle += `\nfabricApi {
    configureDataGeneration()
}\n`;
        }

        await write('build.gradle', buildGradle);

        // 5. fabric.mod.json
        let entrypoints: any = {
            main: [
                `${data.packageName}.${className}`
            ]
        };
        if (data.splitSources) {
            entrypoints.client = [
                `${data.packageName}.client.${className}Client`
            ];
        }
        if (data.dataGen) {
            entrypoints["fabric-datagen"] = [
                `${data.packageName}.datagen.${className}DataGenerator`
            ];
        }

        const fabricModJson = {
            schemaVersion: 1,
            id: modid,
            version: "${version}",
            name: data.projectName,
            description: "A custom Minecraft mod created with MCModMaker.",
            authors: [data.authorName],
            contact: {
                website: data.website
            },
            license: "CC0-1.0",
            icon: "assets/icon.png",
            environment: "*",
            entrypoints: entrypoints,
            mixins: [
                `${modid}.mixins.json`
            ],
            depends: {
                fabricloader: ">=${loader_version}",
                minecraft: "~${minecraft_version}",
                java: `>=${data.javaVersion.replace('Java ', '')}`
            }
        };

        if (data.kotlinLang) {
            // Re-point to kotlin adapters
            if (entrypoints.main) entrypoints.main[0] = { adapter: "kotlin", value: entrypoints.main[0] };
            if (entrypoints.client) entrypoints.client[0] = { adapter: "kotlin", value: entrypoints.client[0] };
            if (entrypoints["fabric-datagen"]) entrypoints["fabric-datagen"][0] = { adapter: "kotlin", value: entrypoints["fabric-datagen"][0] };
            (fabricModJson.depends as any)["fabric-language-kotlin"] = ">=1.10.0";
        }

        await createDir('src/main/resources');
        await write('src/main/resources/fabric.mod.json', JSON.stringify(fabricModJson, null, 2));

        // 6. Main class & package directories
        const ext = data.kotlinLang ? 'kt' : 'java';
        const langPath = data.kotlinLang ? 'kotlin' : 'java';
        const pathBase = data.packageName.replace(/\./g, '/');

        await createDir(`src/main/${langPath}/${pathBase}`);

        // Main file
        if (data.kotlinLang) {
            await write(`src/main/${langPath}/${pathBase}/${className}.kt`, `package ${data.packageName}

import net.fabricmc.api.ModInitializer

object ${className} : ModInitializer {
    override fun onInitialize() {
        println("Initialize Custom Mod!")
    }
}
`);
        } else {
            await write(`src/main/${langPath}/${pathBase}/${className}.java`, `package ${data.packageName};

import net.fabricmc.api.ModInitializer;

public class ${className} implements ModInitializer {
    @Override
    public void onInitialize() {
        System.out.println("Initialize Custom Mod!");
    }
}
`);
        }

        // 7. Split sources / Client code
        if (data.splitSources) {
            await createDir(`src/client/${langPath}/${pathBase}/client`);
            if (data.kotlinLang) {
                await write(`src/client/${langPath}/${pathBase}/client/${className}Client.kt`, `package ${data.packageName}.client

import net.fabricmc.api.ClientModInitializer

object ${className}Client : ClientModInitializer {
    override fun onInitializeClient() {
        // Client init
    }
}
`);
            } else {
                await write(`src/client/${langPath}/${pathBase}/client/${className}Client.java`, `package ${data.packageName}.client;

import net.fabricmc.api.ClientModInitializer;

public class ${className}Client implements ClientModInitializer {
    @Override
    public void onInitializeClient() {
        // Client init
    }
}
`);
            }
        }

        // 8. Data Generation
        if (data.dataGen) {
            await createDir(`src/main/${langPath}/${pathBase}/datagen`);
            if (data.kotlinLang) {
                await write(`src/main/${langPath}/${pathBase}/datagen/${className}DataGenerator.kt`, `package ${data.packageName}.datagen

import net.fabricmc.fabric.api.datagen.v1.DataGeneratorEntrypoint
import net.fabricmc.fabric.api.datagen.v1.FabricDataGenerator

class ${className}DataGenerator : DataGeneratorEntrypoint {
    override fun onInitializeDataGenerator(generator: FabricDataGenerator) {
        val pack = generator.createPack()
        // pack.addProvider(...)
    }
}
`);
            } else {
                await write(`src/main/${langPath}/${pathBase}/datagen/${className}DataGenerator.java`, `package ${data.packageName}.datagen;

import net.fabricmc.fabric.api.datagen.v1.DataGeneratorEntrypoint;
import net.fabricmc.fabric.api.datagen.v1.FabricDataGenerator;

public class ${className}DataGenerator implements DataGeneratorEntrypoint {
    @Override
    public void onInitializeDataGenerator(FabricDataGenerator generator) {
        FabricDataGenerator.Pack pack = generator.createPack();
        // pack.addProvider(...);
    }
}
`);
            }
        }

        vscode.window.showInformationMessage(`Successfully generated ${data.projectName} Fabric Mod!`);
    } catch (e: any) {
        vscode.window.showErrorMessage("Error scaffolding Mod: " + e.message);
        console.error(e);
    }
}
