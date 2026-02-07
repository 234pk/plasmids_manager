/**
 * UniProt API Service
 * 负责与 UniProt 数据库交互，查询蛋白信息
 */
class UniProtService {
    constructor() {
        this.baseUrl = 'https://rest.uniprot.org/uniprotkb';
        this.cache = new Map();
        // 缓存有效期 5 分钟
        this.cacheTimeout = 5 * 60 * 1000;
    }
    
    /**
     * 搜索 UniProt
     * @param {string} query 查询关键词 (如 "P53_HUMAN" 或 "Insulin")
     * @param {object} options 选项 { limit: 10 }
     */
    async search(query, options = {}) {
        if (!query) return { count: 0, results: [] };

        const cacheKey = `search:${query}:${options.limit || 10}:${options.taxId || ''}`;
        if (this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            if (Date.now() - cached.timestamp < this.cacheTimeout) {
                return cached.data;
            } else {
                this.cache.delete(cacheKey);
            }
        }
        
        const limit = options.limit || 10;
        const taxId = options.taxId;
        const fields = 'accession,protein_name,organism_name,cc_function,gene_names,mass,sequence,xref_biogrid,xref_flybase,cc_subcellular_location,xref_refseq,xref_string';

        const escapeQueryTerm = (term) => {
            const t = String(term ?? '').trim();
            if (!t) return '';
            if (/^[A-Za-z0-9_.-]+$/.test(t)) return t;
            return `"${t.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
        };

        const and = (...parts) => `(${parts.filter(Boolean).join(' AND ')})`;
        const or = (...parts) => `(${parts.filter(Boolean).join(' OR ')})`;
        const reviewed = (v) => `(reviewed:${v ? 'true' : 'false'})`;
        const taxonomy = (id) => id ? `(taxonomy_id:${String(id).trim()})` : '';
        const geneExact = (term) => `(gene_exact:${escapeQueryTerm(term)})`;
        const gene = (term) => `(gene:${escapeQueryTerm(term)})`;
        const proteinName = (term) => `(protein_name:${escapeQueryTerm(term)})`;
        const accession = (term) => `(accession:${escapeQueryTerm(term)})`;
        const id = (term) => `(id:${escapeQueryTerm(term)})`;

        const fetchResults = async (q) => {
             const params = new URLSearchParams({
                query: q,
                size: limit,
                format: 'json',
                fields
            });
            const response = await fetch(`${this.baseUrl}/search?${params}`, {
                headers: {
                    Accept: 'application/json'
                }
            });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return await response.json();
        };

        try {
            let results = [];
            
            // 1. Primary Search (Reviewed + Optional TaxId)
            const rawQuery = String(query).trim();
            const taxClause = taxonomy(taxId);
            const term = escapeQueryTerm(rawQuery);

            const looksLikeAccession = /^[A-NR-Z0-9]{6,10}$/.test(rawQuery) || /^[OPQ][0-9][A-Z0-9]{3}[0-9]$/.test(rawQuery);
            const looksLikeEntryName = /^[A-Z0-9]{1,10}_[A-Z0-9]{1,10}$/.test(rawQuery);

            let q = '';
            if (looksLikeAccession) {
                q = and(accession(rawQuery), reviewed(true), taxClause);
            } else if (looksLikeEntryName) {
                q = and(id(rawQuery), reviewed(true), taxClause);
            } else {
                q = and(geneExact(rawQuery), reviewed(true), taxClause);
            }
            
            let data = await fetchResults(q);
            results = data.results || [];

            // 2. Fallback: If taxId used but no results -> Global Search
            if (results.length === 0 && taxId) {
                 // Global Reviewed
                 if (looksLikeAccession) {
                    q = and(accession(rawQuery), reviewed(true));
                 } else if (looksLikeEntryName) {
                    q = and(id(rawQuery), reviewed(true));
                 } else {
                    q = and(geneExact(rawQuery), reviewed(true));
                 }
                 data = await fetchResults(q);
                 results = data.results || [];
                 
                 // Global Unreviewed if still empty
                 if (results.length === 0) {
                     if (looksLikeAccession) {
                        q = and(accession(rawQuery), reviewed(false));
                     } else if (looksLikeEntryName) {
                        q = and(id(rawQuery), reviewed(false));
                     } else {
                        q = and(geneExact(rawQuery), reviewed(false));
                     }
                     data = await fetchResults(q);
                     results = data.results || [];
                 }
            }
            // 3. Fallback: If no taxId and no results -> Unreviewed
            else if (results.length === 0 && !taxId) {
                 if (looksLikeAccession) {
                    q = and(accession(rawQuery), reviewed(false));
                 } else if (looksLikeEntryName) {
                    q = and(id(rawQuery), reviewed(false));
                 } else {
                    q = and(geneExact(rawQuery), reviewed(false));
                 }
                 data = await fetchResults(q);
                 results = data.results || [];
            }

            // 4. Extra Fallback: broader query if still empty
            if (results.length === 0) {
                const broad = or(gene(rawQuery), proteinName(rawQuery), `(${term})`);
                const broaderQueries = [
                    and(broad, reviewed(true), taxClause),
                    and(broad, reviewed(true)),
                    and(broad, reviewed(false), taxClause),
                    and(broad, reviewed(false))
                ];
                for (const candidate of broaderQueries) {
                    try {
                        const d = await fetchResults(candidate);
                        const r = d.results || [];
                        if (r.length > 0) {
                            results = r;
                            break;
                        }
                    } catch (_) {}
                }
            }
            
            // 4. Supplement: If no taxId and results < limit -> Fetch Unreviewed to fill
            if (!taxId && results.length > 0 && results.length < limit) {
                 q = and(geneExact(rawQuery), reviewed(false));
                 const extraData = await fetchResults(q);
                 // Avoid duplicates (by accession)
                 const existingIds = new Set(results.map(r => r.primaryAccession));
                 for (const r of (extraData.results || [])) {
                     if (!existingIds.has(r.primaryAccession)) {
                         results.push(r);
                         if (results.length >= limit) break;
                     }
                 }
            }
            
            const transformedResults = {
                count: results.length,
                results: results.map(r => this.transform(r))
            };
            
            this.cache.set(cacheKey, {
                timestamp: Date.now(),
                data: transformedResults
            });
            
            return transformedResults;
        } catch (error) {
            console.error('UniProt 查询失败:', error);
            return { count: 0, results: [], error: error.message || String(error) };
        }
    }
    
    /**
     * 转换 UniProt 原始数据为前端可用格式
     */
    transform(entry) {
        // 提取细胞定位
        let subcellularLocation = '无细胞定位信息';
        if (entry.comments && entry.comments.length > 0) {
            const locComment = entry.comments.find(c => c.commentType === 'SUBCELLULAR LOCATION');
            if (locComment) {
                if (locComment.subcellularLocations && locComment.subcellularLocations.length > 0) {
                    subcellularLocation = [...new Set(locComment.subcellularLocations.map(i => i.location.value))].join('、');
                } else if (locComment.texts && locComment.texts.length > 0) {
                    subcellularLocation = locComment.texts[0].value;
                }
            }
        }

        // 提取 RefSeq, STRING, FlyBase
        let refSeqId = null;
        let stringId = null;
        let flyBaseId = null;
        if (entry.uniProtKBCrossReferences) {
            const refSeq = entry.uniProtKBCrossReferences.find(r => r.database === 'RefSeq');
            if (refSeq) refSeqId = refSeq.id;
            
            const stringRef = entry.uniProtKBCrossReferences.find(r => r.database === 'STRING');
            if (stringRef) stringId = stringRef.id;

            const flyBaseRef = entry.uniProtKBCrossReferences.find(r => r.database === 'FlyBase');
            if (flyBaseRef) flyBaseId = flyBaseRef.id;
        }

        // 提取并处理功能描述 (支持多条 + 文献链接)
        let functions = [];
        if (entry.comments) {
            entry.comments.forEach(c => {
                if (c.commentType === 'FUNCTION' && c.texts) {
                    c.texts.forEach(t => {
                        if (t.value) {
                            // 处理 PubMed 引用链接: (PubMed:123456) -> 链接
                            let processedText = t.value.replace(
                                /\(PubMed:(\d+)\)/g, 
                                '(<a href="https://pubmed.ncbi.nlm.nih.gov/$1" target="_blank" class="text-blue-600 hover:underline">PubMed:$1</a>)'
                            );
                            functions.push(processedText);
                        }
                    });
                }
            });
        }
        // 如果没有找到功能描述，尝试使用 summary
        if (functions.length === 0 && entry.proteinDescription?.recommendedName?.fullName?.value) {
             // 这种情况下通常没有详细 function，留空或使用名字暂代并不是很好，保持为空数组即可
        }

        return {
            uniprotId: entry.primaryAccession,
            name: entry.proteinDescription?.recommendedName?.fullName?.value || entry.proteinDescription?.submissionNames?.[0]?.fullName?.value,
            altNames: (entry.proteinDescription?.alternativeNames || [])
                .map(n => n.fullName?.value),
            organism: entry.organism?.scientificName,
            geneName: entry.genes?.[0]?.geneName?.value,
            function: functions.length > 0 ? functions.join('\n\n') : '', // 纯文本兼容
            functions: functions, // 数组格式，包含 HTML 链接
            keywords: (entry.keywords || []).map(k => k.value),
            length: entry.sequence?.length,
            mass: entry.sequence?.mass,
            sequence: entry.sequence?.value,
            subcellularLocation,
            refSeqId,
            stringId,
            flyBaseId,
            link: `https://www.uniprot.org/uniprot/${entry.primaryAccession}`
        };
    }
    
    /**
     * 根据 Accession ID 获取详情
     */
    async getById(accession) {
        const params = new URLSearchParams({
            format: 'json',
            fields: 'accession,protein_name,organism_name,function,genes,mass,sequence,features'
        });
        
        try {
            const response = await fetch(`${this.baseUrl}/${accession}.json?${params}`);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            return this.transform(await response.json());
        } catch (error) {
            console.error('UniProt 详情获取失败:', error);
            return null;
        }
    }
}

// 挂载到全局 window 对象
window.UniProtService = new UniProtService();
