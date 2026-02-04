/**
 * GenBank 解析器
 * 解析 .gb / .gbk 文件，提取质粒信息和特征
 */

class GenBankParser {
    constructor() {
        // 特征类型映射
        this.typeMap = {
            'CDS': { type: 'CDS', color: '#4CAF50', label: 'CDS' },
            'gene': { type: 'gene', color: '#4CAF50', label: '基因' },
            'promoter': { type: 'promoter', color: '#2196F3', label: '启动子' },
            '5\'UTR': { type: '5\'UTR', color: '#2196F3', label: '5\'UTR' },
            '3\'UTR': { type: '3\'UTR', color: '#2196F3', label: '3\'UTR' },
            'terminator': { type: 'terminator', color: '#2196F3', label: '终止子' },
            'origin': { type: 'origin', color: '#FF9800', label: '复制起始点' },
            'rep_origin': { type: 'origin', color: '#FF9800', label: '复制起始点' },
            'insert': { type: 'insert', color: '#FF9800', label: '插入片段' },
            'fluorescent': { type: 'fluorescent', color: '#E91E63', label: '荧光蛋白' },
            'resistance': { type: 'resistance', color: '#9C27B0', label: '抗性基因' },
            'primer_bind': { type: 'primer_bind', color: '#607D8B', label: '引物结合位点' },
            'misc_feature': { type: 'other', color: '#9E9E9E', label: '其他' }
        };
    }

    /**
     * 解析 GenBank 文件内容
     * @param {string} content - GenBank 文件内容
     * @returns {object} 解析后的质粒数据
     */
    parse(content) {
        const lines = content.split('\n');
        const result = {
            name: '',
            length: 0,
            features: [],
            sequence: '',
            description: '',
            locus: {}
        };

        let currentSection = '';
        let currentFeature = null;
        let featureLines = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const prefix = line.substring(0, 12);
            const rest = line.substring(12).trim();

            // 检测新的区域
            if (prefix.startsWith('LOCUS')) {
                currentSection = 'LOCUS';
                this._parseLocus(result, rest);
            } else if (prefix.startsWith('DEFINITION')) {
                currentSection = 'DEFINITION';
                result.description = rest;
            } else if (prefix.startsWith('ACCESSION')) {
                currentSection = 'ACCESSION';
            } else if (prefix.startsWith('FEATURES')) {
                currentSection = 'FEATURES';
            } else if (prefix.startsWith('ORIGIN')) {
                currentSection = 'ORIGIN';
                this._parseOrigin(result, lines.slice(i + 1));
                break;
            } else if (line.startsWith('//')) {
                // 文件结束
                break;
            } else {
                // 根据当前区域处理
                if (currentSection === 'LOCUS') {
                    // 继续解析 LOCUS
                } else if (currentSection === 'DEFINITION') {
                    result.description += ' ' + rest;
                } else if (currentSection === 'FEATURES') {
                    this._parseFeatureLine(line, prefix, rest, featureLines, result);
                }
            }
        }

        // 处理特征
        result.features = this._processFeatures(featureLines);

        return result;
    }

    /**
     * 解析文件路径，自动检测格式
     * @param {string} filePath - 文件路径
     * @returns {Promise<object>} 解析后的质粒数据
     */
    async parseFile(filePath) {
        try {
            const response = await fetch(filePath);
            const content = await response.text();
            return this.parse(content);
        } catch (error) {
            console.error('Failed to parse file:', error);
            throw error;
        }
    }

    /**
     * 解析纯文本序列文件（FASTA 格式）
     * @param {string} content - FASTA 内容
     * @returns {object} 质粒数据
     */
    parseFasta(content) {
        const lines = content.split('\n');
        const result = {
            name: '',
            length: 0,
            features: [],
            sequence: '',
            description: ''
        };

        let header = lines[0] || '';
        if (header.startsWith('>')) {
            result.name = header.substring(1).trim().split(/\s+/)[0];
        }

        result.sequence = lines.slice(1).join('').replace(/\s/g, '');
        result.length = result.sequence.length;

        return result;
    }

    _parseLocus(result, line) {
        // LOCUS 格式: LOCUS name length bp DNA circular
        const parts = line.split(/\s+/);
        result.name = parts[0] || '';
        result.length = parseInt(parts[1]) || 0;
        
        result.locus = {
            name: parts[0],
            length: result.length,
            molecule: parts[2] || 'DNA',
            topology: parts[4] || 'circular',
            division: parts[5] || ''
        };
    }

    _parseFeatureLine(line, prefix, rest, featureLines, result) {
        // FEATURES 区域
        if (!prefix.trim()) {
            // 续行
            if (currentFeature) {
                featureLines.push(line.trim());
            }
        } else if (prefix.startsWith('FEATURES')) {
            // FEATURES 标题行
        } else {
            // 新特征开始
            if (currentFeature) {
                featureLines.push(currentFeature);
            }
            currentFeature = {
                raw: line,
                parts: [line]
            };
        }
    }

    _processFeatures(featureLines) {
        const features = [];

        featureLines.forEach(line => {
            const feature = this._parseSingleFeature(line);
            if (feature) {
                features.push(feature);
            }
        });

        return features;
    }

    _parseSingleFeature(line) {
        // 格式: gene                    123..456
        // 或: CDS                     complement(123..456)
        // 或: CDS                     123..456
        //     /gene="name"
        //     /product="protein"
        
        const match = line.match(/^(\S+)\s+(.+)/);
        if (!match) return null;

        const type = match[1];
        const location = match[2];

        // 解析位置
        let start, end, complement = false;
        
        if (location.includes('complement(')) {
            complement = true;
            location = location.replace('complement(', '').replace(')', '');
        }

        const locMatch = location.match(/^(\d+)\.\.(\d+)/);
        if (locMatch) {
            start = parseInt(locMatch[1]);
            end = parseInt(locMatch[2]);
        } else {
            return null;
        }

        // 提取注释
        const nameMatch = line.match(/\/gene="([^"]+)"/);
        const productMatch = line.match(/\/product="([^"]+)"/);
        const labelMatch = line.match(/\/label="([^"]+)"/;
        const noteMatch = line.match(/\/note="([^"]+)"/);

        // 确定名称
        let name = nameMatch ? nameMatch[1] : 
                   labelMatch ? labelMatch[1] :
                   productMatch ? productMatch[1] : 
                   type;

        // 确定类型
        let featureType = type.toLowerCase();
        if (featureType === 'cds') featureType = 'CDS';
        else if (featureType === 'rep_origin') featureType = 'origin';

        const typeConfig = this.typeMap[featureType] || this.typeMap['other'];

        return {
            name: name,
            type: featureType,
            displayType: typeConfig.label,
            color: typeConfig.color,
            start: start,
            end: end,
            length: end - start + 1,
            strand: complement ? '-' : '+',
            description: noteMatch ? noteMatch[1] : ''
        };
    }

    _parseOrigin(result, lines) {
        // ORIGIN 区域包含序列
        let sequence = '';
        lines.forEach(line => {
            const numMatch = line.match(/^\s*\d+\s+(.+)/);
            if (numMatch) {
                sequence += numMatch[1].replace(/\s/g, '');
            }
        });
        result.sequence = sequence.toUpperCase();
        result.length = sequence.length;
    }
}

// 导出
window.GenBankParser = GenBankParser;
