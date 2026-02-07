/**
 * 基于训练数据的智能识别模块
 */
window.RecognitionTrainingData = {
    carriers: ["BRDV2", "BRDV2A", "CRISPR-PLV", "CRISPRv2", "CRISPRv2-blast", "SpCas9-HF1-2A-GFP", "eSpCas9(1.1)", "lentiCRISPR v2", "lentiCRISPR v3", "lentiCas9-Blast", "lentiCas9-GFP", "lentiGuide-GFP", "lentiGuide-Neo", "lentiGuide-Puro", "mCherry-C1", "mCherry-N1", "mCherry-N2", "p3xFLAG-CMV-7", "p3xFLAG-CMV-8", "p3xFLAG-CMV-9", "p426ADH", "p426GAL", "p426GPD", "p426TEF", "pAAVS1-Nst-CRISPR", "pAAVS1-TALEN-L", "pAAVS1-TALEN-R", "pACYC184", "pBAD/Myc-His A", "pBAD/Myc-His C", "pBAD18", "pBAD24", "pBAD33", "pBR327", "pBabe-blast", "pBabe-neo", "pBabe-puro", "pBacPAK8", "pBacPAK9", "pBluescript II KS(+)", "pBluescript II SK(+)", "pCAG-Cre", "pCAG-Cre-ERT2", "pCAG-Flp", "pCDH-CMV-GFP", "pCDH-CMV-RFP", "pCDH-EF1a-puro", "pCDH-MSCV", "pCDH-U6", "pCI", "pCI-neo", "pCMV-C-Flag", "pCMV-C-HA", "pCMV-C-Myc", "pCMV-C-V5", "pCMV-Cre", "pCMV-Cre-IRES", "pCMV-Flp", "pCMV-N-Flag", "pCMV-N-HA", "pCMV-N-Myc", "pCMV-N-V5", "pCMV-Tag2B", "pCMV-Tag3A", "pCMV-Tag5A", "pCMV-VSVG", "pCOLA", "pCOLADuet-1", "pCX-EGFP", "pCX-blast", "pCX-puro", "pCerulean-N1", "pDsRed-Express2", "pDsRed-Monomer-N1", "pECFP-N1", "pEGFP-1", "pEGFP-2", "pEGFP-C1", "pEGFP-C2", "pEGFP-C3", "pEGFP-N1", "pEGFP-N2", "pEGFP-N3", "pESC-HIS", "pESC-LEU", "pESC-TRP", "pESC-URA", "pET-21a", "pET-21a(+)", "pET-22b", "pET-22b(+)", "pET-23a", "pET-23a(+)", "pET-24a", "pET-24a(+)", "pET-25b", "pET-25b(+)", "pET-26b", "pET-26b(+)", "pET-27b", "pET-28a", "pET-28a(+)", "pET-29a", "pET-29a(+)", "pET-30a", "pET-30a(+)", "pET-31b", "pET-31b(+)", "pET-32a", "pET-32a(+)", "pET-33b", "pET-33b(+)", "pET-35b", "pET-35b(+)", "pET-36c", "pET-36c(+)", "pEYFP-N1", "pFRT-amp", "pFRT-neo", "pFUGW", "pFUW-M2", "pFUW-TetOn", "pFastBac1", "pFastBacDual", "pFastBacHT-A", "pFastBacHT-B", "pGEM-3Z", "pGEM-4Z", "pGEM-T", "pGEM-T Easy", "pGEX-4T-1", "pGEX-4T-2", "pGEX-4T-3", "pGEX-5X-1", "pGEX-6P-1", "pGEX-6P-2", "pGL3-Basic", "pGL3-Control", "pGL3-Enhancer", "pGL3-Promoter", "pGL4.10[luc2]", "pGL4.11[luc2]", "pGL4.12[luc2]", "pGL4.13[luc2]", "pGL4.17[luc2]", "pGL4.23[luc2]", "pHAGE-CMV-GFP", "pHSF1A", "pHSF1B", "pIB/V5-DEST", "pIB/V5-His", "pIRES", "pIRES2-EGFP", "pIRES2-mCherry", "pIZ/V5-His", "pLKO.1-GFP", "pLKO.1-Neo", "pLKO.1-blast", "pLKO.1-puro", "pLL3.7", "pLV-hU6-shRNA", "pLV-tdTomato", "pLVCT", "pLVSD", "pLVTHM", "pLVTHM-shRNA", "pLVX-AcGFP", "pLVX-EF1a-GFP", "pLVX-EF1a-mCherry", "pLVX-EF1a-puro", "pLVX-IRES-ZsGreen", "pLVX-IRES-mCherry", "pLVX-IRES-puro", "pLVX-Neo", "pLVX-Puro", "pLentiLox3.7", "pLoxP-Neo", "pLoxP-blast", "pLoxP-puro", "pLuc", "pLuciferase", "pMAL-c2X", "pMAL-c5X", "pMAL-p2X", "pMAL-p5X", "pMD2.8", "pMD2.G", "pMD2.VSVG", "pMDL2", "pMDLg/pRRE", "pMIB/V5-DEST", "pMIB/V5-His", "pMSCV-blast", "pMSCV-neo", "pMSCV-puro", "pQE60", "pQE70", "pQE80L", "pQE81L", "pQE82L", "pQED", "pQEI", "pRL-CMV", "pRL-SV40", "pRL-TK", "pRS313", "pRS314", "pRS315", "pRS316", "pRS423", "pRS424", "pRS425", "pRS426", "pRSV-Rev", "pRetro-SUPER", "pSC101", "pSIREN-RetroQ", "pSIREN-RetroQ-Puro", "pSIREN-shRNA", "pSMPUW-CMV", "pSMPUW-EF1a", "pSMPUW-GFP", "pSpCas9(BB)-2A-GFP", "pSpCas9(BB)-2A-Puro", "pSpCas9n(BB)-2A-GFP", "pSpCas9n(BB)-2A-Puro", "pSuper.GFP", "pSuper.neo", "pSuper.puro", "pTOPO-Blunt", "pTOPO-T", "pTOPO-TA", "pTriEx-1", "pTriEx-1.1", "pTriEx-2.1", "pTriEx-3.1", "pUC18", "pUC19", "pUC57", "pUC57-Kan", "pWPI", "pX330", "pX330A-1", "pX330S-2", "pX330S-3", "pX333", "pX335", "pX335A-1", "pYC12", "pYC2.1", "pYC6", "pYD1", "pYES2", "pYES2.1", "pYES3", "pYES6", "pcDNA3", "pcDNA3.1", "pcDNA3.1(+)", "pcDNA3.1(-)", "psPAX2", "px330", "px330A-1", "px330A-2", "px333", "px335", "px335A-1", "spCas9", "spCas9-GFP", "spCas9-mCherry", "tdTomato-C1", "tdTomato-N1"],
    genes: ["ABL1", "ACVR1", "ACVR2A", "ACVR2B", "ADE2", "ADH1", "AKT1", "APC", "ATM", "ATR", "AXIN1", "AXIN2", "BAD", "BCL2", "BCL2L1", "BCL2L2", "BMPR2", "BRAF", "BRCA1", "BRCA2", "Bcl2", "Brca1", "Brca2", "CCND1", "CCND2", "CCND3", "CCNE1", "CCNE2", "CDK1", "CDK2", "CDK4", "CDK6", "CDKN1A", "CDKN1B", "CDKN2A", "CDKN2B", "CHEK1", "CHEK2", "CTLA4", "Cdk4", "Cdkn1a", "Ctnnb1", "DNMT1", "DNMT3A", "DNMT3B", "E2F1", "E2F2", "E2F3", "EGFR", "EPAS1", "ERBB2", "ERBB3", "FGFR1", "FGFR2", "FOS", "GAL1", "GAL4", "GAL7", "GAL80", "GSK3B", "Gsk3b", "HDAC1", "HDAC10", "HDAC2", "HDAC3", "HDAC4", "HDAC5", "HDAC6", "HDAC7", "HDAC8", "HDAC9", "HES1", "HEY1", "HIF1A", "HIS3", "IFNG", "IL10", "IL2", "IL6", "JAK1", "JAK2", "JAK3", "JUN", "Jun", "KLF4", "KRAS", "Klf4", "Kras", "LAG3", "LEU2", "LIN28A", "LYS2", "MAX", "MCL1", "MDM2", "MDM4", "MLH1", "MSH2", "MSH6", "MTOR", "MYC", "Mapk3", "Mapk8", "Mcl1", "Mtor", "Myc", "NANOG", "NOTCH1", "NOTCH2", "NOTCH3", "Nanog", "Notch1", "Oct4", "PALB2", "PDCD1", "PDGFRA", "PDGFRB", "PDL1", "PDL2", "PGK1", "PIK3CA", "PMS2", "POU5F1", "PTEN", "Pten", "RAD51", "RAD52", "RAD54L", "RAGA", "RAGB", "RB1", "RHEB", "RICTOR", "RPTOR", "Rb1", "Rptor", "SIRT1", "SIRT2", "SIRT3", "SIRT4", "SIRT5", "SIRT6", "SIRT7", "SMAD2", "SMAD3", "SMAD4", "SMAD5", "SMAD7", "SOX2", "SRC", "STAT1", "STAT3", "STAT5A", "STAT5B", "STAT6", "Sox2", "TEF1", "TET1", "TET2", "TET3", "TGFB1", "TGFB2", "TGFBR1", "TGFBR2", "TIGIT", "TIM3", "TP53", "TRP1", "Trp53", "URA3", "VEGFA", "VEGFB", "VEGFC", "WEE1", "WNT1", "WNT3A", "WNT5A", "Wnt3a"],
    tags: ["Twin-Strep", "mNeonGreen", "Cerulean", "tdTomato", "TurboRFP", "StrepII", "mCherry", "10xHis", "3xFlag", "Strep", "9xMyc", "SUMO1", "sfGFP", "6xHis", "SUMO2", "c-Myc", "Venus", "4xV5", "3xHA", "His8", "SUMO", "Flag", "His6", "EGFP", "CFP", "YFP", "MBP", "GFP", "RFP", "GST", "Myc", "His", "HA", "V5"],
    fluorescent: ["Luciferase", "GFP", "RFP"],
    
    carrierResistance: {
        'BRDV2': {'大肠杆菌抗性': ["Carb", "Cm", "Kan", "Rif", "Spec"],'哺乳动物抗性': ["Zeo"],},
        'BRDV2A': {'大肠杆菌抗性': ["Cm", "Kan", "Rif", "Spec", "Strep", "Tet"],'哺乳动物抗性': ["Neo"],},
        'CRISPR-PLV': {'大肠杆菌抗性': ["Cm", "Rif", "Spec", "Strep"],'哺乳动物抗性': ["Puro"],},
        'CRISPRv2': {'大肠杆菌抗性': ["Carb", "Cm", "Rif", "Spec", "Strep", "Tet"],'哺乳动物抗性': ["Blast", "Hyg", "Neo", "Zeo"],},
        'CRISPRv2-blast': {'大肠杆菌抗性': ["Amp", "Carb", "Rif"],'哺乳动物抗性': ["Neo", "Puro"],},
        'SpCas9-HF1-2A-GFP': {'大肠杆菌抗性': ["Carb", "Cm", "Kan", "Rif"],'哺乳动物抗性': ["Blast"],},
        'eSpCas9(1.1)': {'大肠杆菌抗性': ["Cm", "Spec"],'哺乳动物抗性': ["Hyg", "Zeo"],},
        'lentiCRISPR v2': {'大肠杆菌抗性': ["Amp", "Rif", "Tet"],},
        'lentiCRISPR v3': {'大肠杆菌抗性': ["Carb", "Spec"],},
        'lentiCas9-Blast': {'大肠杆菌抗性': ["Rif", "Spec", "Strep"],'哺乳动物抗性': ["Hyg"],},
        'lentiCas9-GFP': {'大肠杆菌抗性': ["Carb", "Cm", "Kan", "Tet"],'哺乳动物抗性': ["Blast", "Hyg", "Neo"],},
        'lentiGuide-GFP': {'大肠杆菌抗性': ["Amp", "Carb", "Cm", "Spec", "Strep", "Tet"],'哺乳动物抗性': ["Blast", "Hyg", "Neo", "Puro", "Zeo"],},
        'lentiGuide-Neo': {'大肠杆菌抗性': ["Amp", "Strep"],'哺乳动物抗性': ["Zeo"],},
        'lentiGuide-Puro': {'大肠杆菌抗性': ["Amp", "Spec", "Tet"],'哺乳动物抗性': ["Hyg"],},
        'mCherry-C1': {'大肠杆菌抗性': ["Carb", "Cm", "Kan"],'哺乳动物抗性': ["Blast", "Hyg", "Neo", "Puro"],},
        'mCherry-N1': {'大肠杆菌抗性': ["Rif", "Spec"],'哺乳动物抗性': ["Blast", "Hyg", "Neo"],},
        'mCherry-N2': {'大肠杆菌抗性': ["Kan"],},
        'p3xFLAG-CMV-7': {'大肠杆菌抗性': ["Rif"],'哺乳动物抗性': ["Neo"],},
        'p3xFLAG-CMV-8': {'大肠杆菌抗性': ["Amp"],},
        'p3xFLAG-CMV-9': {'大肠杆菌抗性': ["Carb", "Kan", "Tet"],'哺乳动物抗性': ["Puro"],},
        'p426ADH': {'大肠杆菌抗性': ["Amp", "Rif", "Strep", "Tet"],},
        'p426GAL': {'大肠杆菌抗性': ["Carb", "Kan", "Tet"],},
        'p426GPD': {'大肠杆菌抗性': ["Kan", "Spec", "Strep"],},
        'p426TEF': {'大肠杆菌抗性': ["Rif", "Strep"],},
        'pAAVS1-Nst-CRISPR': {'大肠杆菌抗性': ["Rif", "Spec"],},
        'pAAVS1-TALEN-L': {'大肠杆菌抗性': ["Tet"],},
        'pAAVS1-TALEN-R': {'大肠杆菌抗性': ["Tet"],},
        'pACYC184': {'大肠杆菌抗性': ["Amp", "Carb", "Spec"],},
        'pBAD/Myc-His A': {'大肠杆菌抗性': ["Amp", "Carb"],'哺乳动物抗性': ["Blast"],},
        'pBAD/Myc-His C': {'大肠杆菌抗性': ["Spec", "Strep"],'哺乳动物抗性': ["Blast", "Neo"],},
        'pBAD18': {'大肠杆菌抗性': ["Amp", "Rif", "Strep", "Tet"],},
        'pBAD24': {'大肠杆菌抗性': ["Amp", "Rif", "Spec", "Strep", "Tet"],},
        'pBAD33': {'大肠杆菌抗性': ["Rif", "Spec"],},
        'pBR327': {'大肠杆菌抗性': ["Amp", "Cm", "Rif", "Strep", "Tet"],},
        'pBabe-blast': {'大肠杆菌抗性': ["Amp", "Spec"],},
        'pBabe-neo': {'大肠杆菌抗性': ["Cm"],},
        'pBabe-puro': {'大肠杆菌抗性': ["Carb", "Cm", "Kan", "Rif"],'哺乳动物抗性': ["Hyg", "Neo"],},
        'pBacPAK8': {'大肠杆菌抗性': ["Kan", "Rif", "Spec", "Strep"],},
        'pBacPAK9': {'大肠杆菌抗性': ["Carb", "Cm", "Spec"],},
        'pBluescript II KS(+)': {'大肠杆菌抗性': ["Carb", "Kan", "Strep", "Tet"],},
        'pBluescript II SK(+)': {'大肠杆菌抗性': ["Carb", "Rif"],},
        'pCAG-Cre': {'大肠杆菌抗性': ["Amp", "Cm", "Kan", "Rif", "Strep"],'哺乳动物抗性': ["Blast", "Zeo"],},
        'pCAG-Cre-ERT2': {'大肠杆菌抗性': ["Cm"],'哺乳动物抗性': ["Blast"],},
        'pCAG-Flp': {'大肠杆菌抗性': ["Amp"],'哺乳动物抗性': ["Puro"],},
        'pCDH-CMV-GFP': {'大肠杆菌抗性': ["Amp", "Carb", "Strep"],'哺乳动物抗性': ["Zeo"],},
        'pCDH-CMV-RFP': {'大肠杆菌抗性': ["Cm", "Rif", "Spec", "Tet"],'哺乳动物抗性': ["Blast", "Hyg", "Neo"],},
        'pCDH-EF1a-puro': {'大肠杆菌抗性': ["Amp", "Cm", "Strep", "Tet"],'哺乳动物抗性': ["Hyg", "Puro"],},
        'pCDH-MSCV': {'大肠杆菌抗性': ["Amp", "Carb", "Cm", "Spec", "Strep", "Tet"],'哺乳动物抗性': ["Blast", "Neo", "Zeo"],},
        'pCDH-U6': {'大肠杆菌抗性': ["Amp", "Cm", "Spec", "Tet"],'哺乳动物抗性': ["Blast", "Puro"],},
        'pCI': {'大肠杆菌抗性': ["Strep", "Tet"],'哺乳动物抗性': ["Blast", "Neo"],},
        'pCI-neo': {'大肠杆菌抗性': ["Cm", "Spec", "Tet"],'哺乳动物抗性': ["Blast", "Hyg"],},
        'pCMV-C-Flag': {'大肠杆菌抗性': ["Tet"],'哺乳动物抗性': ["Blast"],},
        'pCMV-C-HA': {'大肠杆菌抗性': ["Amp"],'哺乳动物抗性': ["Blast"],},
        'pCMV-C-Myc': {'大肠杆菌抗性': ["Strep"],'哺乳动物抗性': ["Blast"],},
        'pCMV-C-V5': {'大肠杆菌抗性': ["Amp", "Spec"],'哺乳动物抗性': ["Zeo"],},
        'pCMV-Cre': {'大肠杆菌抗性': ["Kan", "Rif", "Strep"],'哺乳动物抗性': ["Hyg"],},
        'pCMV-Cre-IRES': {'大肠杆菌抗性': ["Amp", "Spec"],'哺乳动物抗性': ["Neo"],},
        'pCMV-Flp': {'大肠杆菌抗性': ["Amp", "Cm", "Rif", "Spec", "Strep"],'哺乳动物抗性': ["Blast", "Puro", "Zeo"],},
        'pCMV-N-Flag': {'大肠杆菌抗性': ["Carb"],'哺乳动物抗性': ["Puro"],},
        'pCMV-N-HA': {'大肠杆菌抗性': ["Kan"],},
        'pCMV-N-Myc': {'大肠杆菌抗性': ["Rif", "Spec", "Tet"],'哺乳动物抗性': ["Blast", "Hyg", "Neo"],},
        'pCMV-N-V5': {'大肠杆菌抗性': ["Carb"],'哺乳动物抗性': ["Blast"],},
        'pCMV-Tag2B': {'大肠杆菌抗性': ["Strep"],'哺乳动物抗性': ["Blast"],},
        'pCMV-Tag3A': {'大肠杆菌抗性': ["Spec"],'哺乳动物抗性': ["Neo"],},
        'pCMV-Tag5A': {'大肠杆菌抗性': ["Amp", "Spec"],'哺乳动物抗性': ["Blast", "Neo", "Puro"],},
        'pCMV-VSVG': {'大肠杆菌抗性': ["Amp", "Cm", "Kan", "Tet"],'哺乳动物抗性': ["Hyg", "Neo", "Puro"],},
        'pCOLA': {'大肠杆菌抗性': ["Kan"],},
        'pCOLADuet-1': {'大肠杆菌抗性': ["Carb", "Kan", "Spec", "Tet"],},
        'pCX-EGFP': {'大肠杆菌抗性': ["Amp", "Rif", "Strep", "Tet"],'哺乳动物抗性': ["Blast", "Puro"],},
        'pCX-blast': {'大肠杆菌抗性': ["Amp", "Kan", "Spec", "Strep", "Tet"],'哺乳动物抗性': ["Blast", "Puro"],},
        'pCX-puro': {'大肠杆菌抗性': ["Amp", "Carb"],},
        'pCerulean-N1': {'大肠杆菌抗性': ["Amp", "Rif", "Spec"],'哺乳动物抗性': ["Blast", "Puro", "Zeo"],},
        'pDsRed-Express2': {'大肠杆菌抗性': ["Kan", "Rif", "Spec", "Tet"],},
        'pDsRed-Monomer-N1': {'大肠杆菌抗性': ["Rif"],'哺乳动物抗性': ["Blast"],},
        'pECFP-N1': {'大肠杆菌抗性': ["Spec"],'哺乳动物抗性': ["Puro"],},
        'pEGFP-1': {'大肠杆菌抗性': ["Amp"],},
        'pEGFP-2': {'大肠杆菌抗性': ["Amp", "Cm"],},
        'pEGFP-C1': {'大肠杆菌抗性': ["Kan", "Rif", "Strep", "Tet"],'哺乳动物抗性': ["Blast", "Neo", "Puro", "Zeo"],},
        'pEGFP-C2': {'大肠杆菌抗性': ["Strep"],},
        'pEGFP-C3': {'大肠杆菌抗性': ["Carb", "Kan", "Rif"],},
        'pEGFP-N1': {'大肠杆菌抗性': ["Amp", "Carb", "Rif", "Spec", "Strep"],'哺乳动物抗性': ["Blast", "Hyg", "Neo"],},
        'pEGFP-N2': {'大肠杆菌抗性': ["Cm", "Rif", "Tet"],},
        'pEGFP-N3': {'大肠杆菌抗性': ["Cm", "Spec"],},
        'pESC-HIS': {'大肠杆菌抗性': ["Amp", "Cm"],},
        'pESC-LEU': {'大肠杆菌抗性': ["Amp", "Cm", "Spec"],},
        'pESC-TRP': {'大肠杆菌抗性': ["Amp"],},
        'pESC-URA': {'大肠杆菌抗性': ["Carb", "Tet"],},
        'pET-21a': {'大肠杆菌抗性': ["Carb", "Spec", "Strep"],'哺乳动物抗性': ["Hyg", "Puro", "Zeo"],},
        'pET-21a(+)': {'大肠杆菌抗性': ["Amp", "Spec"],'哺乳动物抗性': ["Neo", "Puro"],},
        'pET-22b': {'大肠杆菌抗性': ["Rif", "Strep"],'哺乳动物抗性': ["Zeo"],},
        'pET-22b(+)': {'大肠杆菌抗性': ["Carb", "Tet"],'哺乳动物抗性': ["Puro"],},
        'pET-23a': {'大肠杆菌抗性': ["Cm", "Strep"],},
        'pET-23a(+)': {'大肠杆菌抗性': ["Rif", "Strep"],'哺乳动物抗性': ["Blast"],},
        'pET-24a': {'大肠杆菌抗性': ["Amp", "Tet"],'哺乳动物抗性': ["Puro"],},
        'pET-24a(+)': {'大肠杆菌抗性': ["Kan", "Strep"],'哺乳动物抗性': ["Blast"],},
        'pET-25b': {'大肠杆菌抗性': ["Kan"],'哺乳动物抗性': ["Blast"],},
        'pET-25b(+)': {'大肠杆菌抗性': ["Spec"],'哺乳动物抗性': ["Hyg"],},
        'pET-26b': {'大肠杆菌抗性': ["Spec"],'哺乳动物抗性': ["Hyg"],},
        'pET-26b(+)': {'大肠杆菌抗性': ["Cm"],'哺乳动物抗性': ["Blast"],},
        'pET-27b': {'大肠杆菌抗性': ["Kan"],'哺乳动物抗性': ["Neo"],},
        'pET-28a': {'大肠杆菌抗性': ["Amp", "Carb", "Cm", "Rif", "Spec", "Tet"],'哺乳动物抗性': ["Neo", "Puro", "Zeo"],},
        'pET-28a(+)': {'大肠杆菌抗性': ["Amp", "Spec"],'哺乳动物抗性': ["Blast"],},
        'pET-29a': {'大肠杆菌抗性': ["Kan", "Rif", "Strep", "Tet"],'哺乳动物抗性': ["Blast", "Hyg"],},
        'pET-29a(+)': {'大肠杆菌抗性': ["Carb", "Strep"],'哺乳动物抗性': ["Hyg", "Zeo"],},
        'pET-30a': {'大肠杆菌抗性': ["Amp"],'哺乳动物抗性': ["Zeo"],},
        'pET-30a(+)': {'大肠杆菌抗性': ["Kan"],},
        'pET-31b': {'大肠杆菌抗性': ["Spec", "Tet"],'哺乳动物抗性': ["Zeo"],},
        'pET-31b(+)': {'大肠杆菌抗性': ["Cm"],'哺乳动物抗性': ["Neo"],},
        'pET-32a': {'大肠杆菌抗性': ["Kan", "Rif"],'哺乳动物抗性': ["Blast", "Hyg"],},
        'pET-32a(+)': {'大肠杆菌抗性': ["Carb", "Rif", "Tet"],'哺乳动物抗性': ["Hyg", "Zeo"],},
        'pET-33b': {'大肠杆菌抗性': ["Kan"],},
        'pET-33b(+)': {'大肠杆菌抗性': ["Amp"],'哺乳动物抗性': ["Puro", "Zeo"],},
        'pET-35b': {'大肠杆菌抗性': ["Carb", "Spec"],},
        'pET-35b(+)': {'大肠杆菌抗性': ["Cm", "Rif", "Spec", "Strep"],'哺乳动物抗性': ["Blast", "Hyg", "Puro", "Zeo"],},
        'pET-36c': {'大肠杆菌抗性': ["Amp", "Rif"],'哺乳动物抗性': ["Zeo"],},
        'pET-36c(+)': {'大肠杆菌抗性': ["Cm", "Rif", "Strep"],'哺乳动物抗性': ["Neo", "Puro"],},
        'pEYFP-N1': {'大肠杆菌抗性': ["Amp", "Kan", "Strep"],'哺乳动物抗性': ["Neo", "Puro", "Zeo"],},
        'pFRT-amp': {'大肠杆菌抗性': ["Strep", "Tet"],},
        'pFRT-neo': {'大肠杆菌抗性': ["Rif", "Spec"],'哺乳动物抗性': ["Puro"],},
        'pFUGW': {'大肠杆菌抗性': ["Amp", "Carb", "Kan", "Spec", "Strep"],'哺乳动物抗性': ["Blast", "Hyg", "Neo", "Zeo"],},
        'pFUW-M2': {'大肠杆菌抗性': ["Amp", "Spec", "Strep"],'哺乳动物抗性': ["Puro", "Zeo"],},
        'pFUW-TetOn': {'大肠杆菌抗性': ["Carb", "Kan", "Rif", "Strep"],'哺乳动物抗性': ["Neo", "Puro", "Zeo"],},
        'pFastBac1': {'大肠杆菌抗性': ["Cm", "Kan", "Tet"],},
        'pFastBacDual': {'大肠杆菌抗性': ["Spec", "Strep", "Tet"],},
        'pFastBacHT-A': {'大肠杆菌抗性': ["Amp", "Carb", "Cm", "Kan", "Tet"],},
        'pFastBacHT-B': {'大肠杆菌抗性': ["Carb", "Cm", "Kan", "Rif", "Tet"],},
        'pGEM-3Z': {'大肠杆菌抗性': ["Spec"],},
        'pGEM-4Z': {'大肠杆菌抗性': ["Amp", "Rif", "Strep", "Tet"],},
        'pGEM-T': {'大肠杆菌抗性': ["Carb", "Cm", "Strep"],},
        'pGEM-T Easy': {'大肠杆菌抗性': ["Rif", "Tet"],},
        'pGEX-4T-1': {'大肠杆菌抗性': ["Amp", "Carb", "Kan", "Rif"],'哺乳动物抗性': ["Blast", "Hyg", "Puro"],},
        'pGEX-4T-2': {'大肠杆菌抗性': ["Rif"],'哺乳动物抗性': ["Neo"],},
        'pGEX-4T-3': {'大肠杆菌抗性': ["Kan"],},
        'pGEX-5X-1': {'大肠杆菌抗性': ["Carb", "Rif"],},
        'pGEX-6P-1': {'大肠杆菌抗性': ["Carb", "Spec"],'哺乳动物抗性': ["Zeo"],},
        'pGEX-6P-2': {'大肠杆菌抗性': ["Tet"],'哺乳动物抗性': ["Neo"],},
        'pGL3-Basic': {'大肠杆菌抗性': ["Carb", "Rif", "Strep"],},
        'pGL3-Control': {'大肠杆菌抗性': ["Strep"],},
        'pGL3-Enhancer': {'大肠杆菌抗性': ["Tet"],},
        'pGL3-Promoter': {'大肠杆菌抗性': ["Carb", "Rif", "Tet"],},
        'pGL4.10[luc2]': {'大肠杆菌抗性': ["Rif", "Spec"],},
        'pGL4.11[luc2]': {'大肠杆菌抗性': ["Amp", "Spec"],},
        'pGL4.12[luc2]': {'大肠杆菌抗性': ["Kan", "Strep"],},
        'pGL4.13[luc2]': {'大肠杆菌抗性': ["Kan", "Rif"],},
        'pGL4.17[luc2]': {'大肠杆菌抗性': ["Carb"],},
        'pGL4.23[luc2]': {'大肠杆菌抗性': ["Cm", "Kan", "Spec"],},
        'pHAGE-CMV-GFP': {'大肠杆菌抗性': ["Amp", "Kan", "Tet"],'哺乳动物抗性': ["Blast", "Hyg", "Zeo"],},
        'pHSF1A': {'大肠杆菌抗性': ["Kan", "Rif", "Strep"],'哺乳动物抗性': ["Hyg", "Zeo"],},
        'pHSF1B': {'大肠杆菌抗性': ["Kan", "Rif", "Spec", "Tet"],'哺乳动物抗性': ["Blast", "Hyg", "Neo"],},
        'pIB/V5-DEST': {'大肠杆菌抗性': ["Carb", "Kan", "Rif"],},
        'pIB/V5-His': {'大肠杆菌抗性': ["Carb", "Kan"],},
        'pIRES': {'大肠杆菌抗性': ["Amp"],},
        'pIRES2-EGFP': {'大肠杆菌抗性': ["Carb", "Cm", "Kan", "Rif", "Spec"],'哺乳动物抗性': ["Puro", "Zeo"],},
        'pIRES2-mCherry': {'大肠杆菌抗性': ["Amp", "Strep"],},
        'pIZ/V5-His': {'大肠杆菌抗性': ["Amp", "Cm", "Strep", "Tet"],},
        'pLKO.1-GFP': {'大肠杆菌抗性': ["Cm", "Kan", "Rif", "Spec", "Strep"],'哺乳动物抗性': ["Blast", "Hyg", "Neo", "Puro", "Zeo"],},
        'pLKO.1-Neo': {'大肠杆菌抗性': ["Carb", "Kan", "Spec", "Tet"],'哺乳动物抗性': ["Blast", "Hyg", "Puro", "Zeo"],},
        'pLKO.1-blast': {'大肠杆菌抗性': ["Amp", "Carb", "Cm", "Kan", "Rif", "Spec", "Strep"],'哺乳动物抗性': ["Blast", "Hyg", "Neo", "Puro", "Zeo"],},
        'pLKO.1-puro': {'大肠杆菌抗性': ["Amp", "Carb", "Cm", "Kan", "Rif", "Strep", "Tet"],'哺乳动物抗性': ["Blast", "Neo", "Puro"],},
        'pLL3.7': {'大肠杆菌抗性': ["Carb", "Cm", "Kan", "Strep", "Tet"],'哺乳动物抗性': ["Blast", "Hyg", "Puro", "Zeo"],},
        'pLV-hU6-shRNA': {'大肠杆菌抗性': ["Carb", "Cm", "Kan", "Spec", "Tet"],'哺乳动物抗性': ["Blast", "Hyg", "Puro", "Zeo"],},
        'pLV-tdTomato': {'大肠杆菌抗性': ["Amp", "Carb", "Cm", "Kan"],'哺乳动物抗性': ["Hyg", "Puro"],},
        'pLVCT': {'大肠杆菌抗性': ["Carb", "Kan", "Rif"],'哺乳动物抗性': ["Blast"],},
        'pLVSD': {'大肠杆菌抗性': ["Amp", "Cm"],'哺乳动物抗性': ["Blast"],},
        'pLVTHM': {'大肠杆菌抗性': ["Amp", "Carb", "Rif", "Tet"],'哺乳动物抗性': ["Blast", "Hyg", "Puro", "Zeo"],},
        'pLVTHM-shRNA': {'大肠杆菌抗性': ["Amp", "Carb", "Cm", "Kan", "Rif", "Spec", "Strep", "Tet"],'哺乳动物抗性': ["Blast", "Hyg", "Neo", "Puro", "Zeo"],},
        'pLVX-AcGFP': {'大肠杆菌抗性': ["Amp", "Cm", "Rif", "Spec", "Tet"],'哺乳动物抗性': ["Blast", "Hyg", "Neo", "Puro"],},
        'pLVX-EF1a-GFP': {'大肠杆菌抗性': ["Amp", "Tet"],'哺乳动物抗性': ["Hyg"],},
        'pLVX-EF1a-mCherry': {'大肠杆菌抗性': ["Cm", "Rif", "Tet"],'哺乳动物抗性': ["Blast", "Hyg", "Neo", "Zeo"],},
        'pLVX-EF1a-puro': {'大肠杆菌抗性': ["Amp", "Cm", "Rif", "Spec", "Strep", "Tet"],'哺乳动物抗性': ["Blast", "Hyg", "Neo", "Zeo"],},
        'pLVX-IRES-ZsGreen': {'大肠杆菌抗性': ["Carb", "Cm", "Spec", "Strep"],'哺乳动物抗性': ["Blast", "Neo"],},
        'pLVX-IRES-mCherry': {'大肠杆菌抗性': ["Carb", "Spec", "Strep", "Tet"],'哺乳动物抗性': ["Hyg", "Zeo"],},
        'pLVX-IRES-puro': {'大肠杆菌抗性': ["Amp", "Carb", "Cm", "Kan"],'哺乳动物抗性': ["Blast", "Neo", "Puro"],},
        'pLVX-Neo': {'大肠杆菌抗性': ["Rif"],'哺乳动物抗性': ["Blast"],},
        'pLVX-Puro': {'大肠杆菌抗性': ["Carb"],'哺乳动物抗性': ["Hyg"],},
        'pLentiLox3.7': {'大肠杆菌抗性': ["Amp", "Carb", "Kan", "Rif", "Spec", "Strep", "Tet"],'哺乳动物抗性': ["Blast", "Neo", "Puro", "Zeo"],},
        'pLoxP-Neo': {'大肠杆菌抗性': ["Spec"],'哺乳动物抗性': ["Zeo"],},
        'pLoxP-blast': {'大肠杆菌抗性': ["Carb", "Cm", "Kan", "Spec", "Tet"],'哺乳动物抗性': ["Blast", "Neo", "Puro"],},
        'pLoxP-puro': {'大肠杆菌抗性': ["Spec", "Tet"],},
        'pLuc': {'大肠杆菌抗性': ["Carb"],},
        'pLuciferase': {'大肠杆菌抗性': ["Amp", "Carb", "Spec"],},
        'pMAL-c2X': {'大肠杆菌抗性': ["Amp", "Carb", "Strep", "Tet"],'哺乳动物抗性': ["Blast", "Neo", "Zeo"],},
        'pMAL-c5X': {'大肠杆菌抗性': ["Amp", "Strep"],'哺乳动物抗性': ["Neo"],},
        'pMAL-p2X': {'大肠杆菌抗性': ["Amp", "Rif", "Tet"],'哺乳动物抗性': ["Hyg", "Zeo"],},
        'pMAL-p5X': {'大肠杆菌抗性': ["Kan"],},
        'pMD2.8': {'大肠杆菌抗性': ["Strep", "Tet"],'哺乳动物抗性': ["Hyg"],},
        'pMD2.G': {'大肠杆菌抗性': ["Spec", "Strep", "Tet"],'哺乳动物抗性': ["Blast", "Hyg", "Puro"],},
        'pMD2.VSVG': {'大肠杆菌抗性': ["Cm", "Spec"],'哺乳动物抗性': ["Blast", "Neo"],},
        'pMDL2': {'大肠杆菌抗性': ["Carb", "Kan"],'哺乳动物抗性': ["Blast", "Hyg", "Zeo"],},
        'pMDLg/pRRE': {'大肠杆菌抗性': ["Carb", "Cm", "Rif"],'哺乳动物抗性': ["Neo", "Zeo"],},
        'pMIB/V5-DEST': {'大肠杆菌抗性': ["Carb"],},
        'pMIB/V5-His': {'大肠杆菌抗性': ["Amp", "Carb", "Spec", "Tet"],},
        'pMSCV-blast': {'大肠杆菌抗性': ["Amp", "Carb", "Tet"],'哺乳动物抗性': ["Blast", "Hyg", "Puro"],},
        'pMSCV-neo': {'大肠杆菌抗性': ["Kan"],'哺乳动物抗性': ["Puro"],},
        'pMSCV-puro': {'大肠杆菌抗性': ["Amp", "Cm", "Kan"],'哺乳动物抗性': ["Hyg", "Puro"],},
        'pQE60': {'大肠杆菌抗性': ["Rif"],'哺乳动物抗性': ["Puro"],},
        'pQE70': {'大肠杆菌抗性': ["Carb", "Strep"],'哺乳动物抗性': ["Puro"],},
        'pQE80L': {'大肠杆菌抗性': ["Amp", "Cm", "Spec"],'哺乳动物抗性': ["Blast", "Puro"],},
        'pQE81L': {'大肠杆菌抗性': ["Amp"],'哺乳动物抗性': ["Hyg"],},
        'pQE82L': {'大肠杆菌抗性': ["Carb", "Strep"],'哺乳动物抗性': ["Puro"],},
        'pQED': {'大肠杆菌抗性': ["Carb"],'哺乳动物抗性': ["Hyg"],},
        'pQEI': {'大肠杆菌抗性': ["Cm", "Kan", "Rif", "Strep"],'哺乳动物抗性': ["Hyg", "Puro"],},
        'pRL-CMV': {'大肠杆菌抗性': ["Carb"],},
        'pRL-SV40': {'大肠杆菌抗性': ["Amp", "Carb", "Kan", "Tet"],},
        'pRL-TK': {'大肠杆菌抗性': ["Kan", "Spec", "Strep", "Tet"],},
        'pRS313': {'大肠杆菌抗性': ["Kan", "Rif", "Strep"],},
        'pRS314': {'大肠杆菌抗性': ["Amp", "Rif", "Strep"],},
        'pRS315': {'大肠杆菌抗性': ["Rif", "Tet"],},
        'pRS316': {'大肠杆菌抗性': ["Cm", "Rif", "Spec"],},
        'pRS423': {'大肠杆菌抗性': ["Amp", "Strep"],},
        'pRS424': {'大肠杆菌抗性': ["Carb", "Rif", "Strep"],},
        'pRS425': {'大肠杆菌抗性': ["Amp", "Cm", "Rif", "Spec", "Strep"],},
        'pRS426': {'大肠杆菌抗性': ["Cm", "Kan", "Rif"],},
        'pRSV-Rev': {'大肠杆菌抗性': ["Carb", "Kan", "Strep"],'哺乳动物抗性': ["Blast", "Puro", "Zeo"],},
        'pRetro-SUPER': {'大肠杆菌抗性': ["Amp", "Carb", "Cm", "Kan", "Spec", "Strep", "Tet"],'哺乳动物抗性': ["Blast", "Hyg", "Neo", "Puro", "Zeo"],},
        'pSC101': {'大肠杆菌抗性': ["Kan", "Tet"],},
        'pSIREN-RetroQ': {'大肠杆菌抗性': ["Amp", "Carb", "Cm", "Kan", "Spec", "Strep", "Tet"],'哺乳动物抗性': ["Blast", "Hyg", "Neo", "Puro", "Zeo"],},
        'pSIREN-RetroQ-Puro': {'大肠杆菌抗性': ["Cm", "Kan", "Spec", "Strep"],'哺乳动物抗性': ["Blast", "Hyg", "Neo", "Puro", "Zeo"],},
        'pSIREN-shRNA': {'大肠杆菌抗性': ["Amp", "Carb", "Kan", "Rif", "Spec", "Tet"],'哺乳动物抗性': ["Blast", "Neo", "Puro", "Zeo"],},
        'pSMPUW-CMV': {'大肠杆菌抗性': ["Amp", "Kan", "Strep"],'哺乳动物抗性': ["Blast", "Zeo"],},
        'pSMPUW-EF1a': {'大肠杆菌抗性': ["Amp", "Cm"],'哺乳动物抗性': ["Hyg"],},
        'pSMPUW-GFP': {'大肠杆菌抗性': ["Amp", "Cm", "Rif"],'哺乳动物抗性': ["Hyg", "Zeo"],},
        'pSpCas9(BB)-2A-GFP': {'大肠杆菌抗性': ["Amp", "Rif", "Spec", "Strep", "Tet"],'哺乳动物抗性': ["Blast", "Puro"],},
        'pSpCas9(BB)-2A-Puro': {'大肠杆菌抗性': ["Spec", "Strep"],'哺乳动物抗性': ["Hyg", "Zeo"],},
        'pSpCas9n(BB)-2A-GFP': {'大肠杆菌抗性': ["Carb", "Kan", "Strep"],'哺乳动物抗性': ["Blast", "Puro"],},
        'pSpCas9n(BB)-2A-Puro': {'大肠杆菌抗性': ["Carb", "Kan", "Rif"],'哺乳动物抗性': ["Neo"],},
        'pSuper.GFP': {'大肠杆菌抗性': ["Carb", "Rif"],'哺乳动物抗性': ["Hyg", "Puro", "Zeo"],},
        'pSuper.neo': {'大肠杆菌抗性': ["Carb", "Cm", "Kan", "Rif", "Strep", "Tet"],'哺乳动物抗性': ["Hyg", "Neo", "Zeo"],},
        'pSuper.puro': {'大肠杆菌抗性': ["Amp", "Carb", "Cm", "Rif", "Spec", "Strep"],'哺乳动物抗性': ["Blast", "Hyg", "Neo", "Puro", "Zeo"],},
        'pTOPO-Blunt': {'大肠杆菌抗性': ["Cm", "Kan", "Rif", "Tet"],},
        'pTOPO-T': {'大肠杆菌抗性': ["Kan", "Rif", "Spec", "Tet"],},
        'pTOPO-TA': {'大肠杆菌抗性': ["Cm", "Spec", "Strep"],},
        'pTriEx-1': {'大肠杆菌抗性': ["Amp", "Cm", "Rif"],},
        'pTriEx-1.1': {'大肠杆菌抗性': ["Spec"],'哺乳动物抗性': ["Neo"],},
        'pTriEx-2.1': {'大肠杆菌抗性': ["Amp", "Cm", "Tet"],'哺乳动物抗性': ["Puro"],},
        'pTriEx-3.1': {'大肠杆菌抗性': ["Rif", "Tet"],'哺乳动物抗性': ["Blast", "Zeo"],},
        'pUC18': {'大肠杆菌抗性': ["Amp", "Rif", "Spec"],},
        'pUC19': {'大肠杆菌抗性': ["Tet"],},
        'pUC57': {'大肠杆菌抗性': ["Kan"],},
        'pUC57-Kan': {'大肠杆菌抗性': ["Cm", "Rif", "Strep"],},
        'pWPI': {'大肠杆菌抗性': ["Spec", "Strep"],'哺乳动物抗性': ["Hyg", "Neo"],},
        'pX330': {'大肠杆菌抗性': ["Cm", "Strep"],'哺乳动物抗性': ["Puro"],},
        'pX330A-1': {'大肠杆菌抗性': ["Spec"],'哺乳动物抗性': ["Neo"],},
        'pX330S-2': {'大肠杆菌抗性': ["Rif", "Spec"],'哺乳动物抗性': ["Puro"],},
        'pX330S-3': {'大肠杆菌抗性': ["Amp", "Carb", "Kan", "Spec"],'哺乳动物抗性': ["Puro", "Zeo"],},
        'pX333': {'大肠杆菌抗性': ["Kan", "Rif", "Strep", "Tet"],'哺乳动物抗性': ["Blast"],},
        'pX335': {'大肠杆菌抗性': ["Rif", "Spec", "Strep"],'哺乳动物抗性': ["Neo"],},
        'pX335A-1': {'大肠杆菌抗性': ["Cm", "Spec", "Strep"],'哺乳动物抗性': ["Hyg", "Zeo"],},
        'pYC12': {'大肠杆菌抗性': ["Cm", "Strep"],},
        'pYC2.1': {'大肠杆菌抗性': ["Kan", "Rif", "Spec"],},
        'pYC6': {'大肠杆菌抗性': ["Kan", "Rif", "Tet"],},
        'pYD1': {'大肠杆菌抗性': ["Carb", "Tet"],},
        'pYES2': {'大肠杆菌抗性': ["Amp", "Kan", "Strep"],},
        'pYES2.1': {'大肠杆菌抗性': ["Cm", "Spec", "Tet"],},
        'pYES3': {'大肠杆菌抗性': ["Cm", "Kan", "Rif", "Spec"],},
        'pYES6': {'大肠杆菌抗性': ["Amp", "Carb", "Cm", "Spec", "Tet"],},
        'pcDNA3': {'大肠杆菌抗性': ["Carb", "Rif"],},
        'pcDNA3.1': {'大肠杆菌抗性': ["Carb", "Kan", "Spec"],},
        'pcDNA3.1(+)': {'大肠杆菌抗性': ["Amp", "Carb", "Spec", "Tet"],'哺乳动物抗性': ["Hyg"],},
        'pcDNA3.1(-)': {'大肠杆菌抗性': ["Amp"],'哺乳动物抗性': ["Zeo"],},
        'psPAX2': {'大肠杆菌抗性': ["Amp", "Kan", "Rif", "Strep", "Tet"],'哺乳动物抗性': ["Blast", "Hyg", "Neo"],},
        'px330': {'大肠杆菌抗性': ["Amp", "Carb", "Cm", "Rif", "Spec", "Strep", "Tet"],'哺乳动物抗性': ["Hyg", "Puro", "Zeo"],},
        'px330A-1': {'大肠杆菌抗性': ["Cm", "Kan", "Spec"],'哺乳动物抗性': ["Blast", "Puro"],},
        'px330A-2': {'大肠杆菌抗性': ["Carb", "Cm", "Rif", "Tet"],'哺乳动物抗性': ["Puro", "Zeo"],},
        'px333': {'大肠杆菌抗性': ["Kan", "Spec", "Tet"],'哺乳动物抗性': ["Hyg", "Zeo"],},
        'px335': {'大肠杆菌抗性': ["Cm", "Kan", "Rif", "Strep"],},
        'px335A-1': {'大肠杆菌抗性': ["Cm", "Spec"],'哺乳动物抗性': ["Hyg", "Zeo"],},
        'spCas9': {'大肠杆菌抗性': ["Carb", "Tet"],'哺乳动物抗性': ["Zeo"],},
        'spCas9-GFP': {'大肠杆菌抗性': ["Amp", "Carb", "Cm"],'哺乳动物抗性': ["Hyg", "Puro"],},
        'spCas9-mCherry': {'大肠杆菌抗性': ["Cm", "Kan", "Spec"],'哺乳动物抗性': ["Zeo"],},
        'tdTomato-C1': {'大肠杆菌抗性': ["Spec", "Tet"],'哺乳动物抗性': ["Puro"],},
        'tdTomato-N1': {'大肠杆菌抗性': ["Cm", "Spec"],'哺乳动物抗性': ["Blast"],},
    },
    
    recognize: function(filename) {
        const result = {
            载体类型: new Set(),
            靶基因: new Set(),
            功能: new Set(),
            蛋白标签: new Set(),
            荧光蛋白: new Set(),
            大肠杆菌抗性: new Set(),
            哺乳动物抗性: new Set(),
            置信度: 0
        };
        
        const normalized = filename.toUpperCase();
        let matches = 0;
        
        for (const carrier of this.carriers) {
            if (normalized.includes(carrier.toUpperCase())) {
                result.载体类型.add(carrier);
                matches++;
                
                const resists = this.carrierResistance[carrier];
                if (resists) {
                    if (resists.大肠杆菌抗性) resists.大肠杆菌抗性.forEach(r => result.大肠杆菌抗性.add(r));
                    if (resists.哺乳动物抗性) resists.哺乳动物抗性.forEach(r => result.哺乳动物抗性.add(r));
                }
                
                if (carrier.includes('Lenti') || carrier.includes('psPAX') || carrier.includes('pMD')) {
                    result.功能.add('病毒包装');
                } else if (carrier.includes('CRISPR') || carrier.includes('Cas9')) {
                    result.功能.add('CRISPR');
                } else if (carrier.includes('pLKO')) {
                    result.功能.add('shRNA');
                } else if (carrier.includes('pET') || carrier.includes('pGEX')) {
                    result.功能.add('原核表达');
                } else if (carrier.includes('pcDNA') || carrier.includes('pCMV')) {
                    result.功能.add('哺乳动物表达');
                }
            }
        }
        
        for (const gene of this.genes) {
            if (normalized.includes(gene)) {
                result.靶基因.add(gene);
                matches++;
            }
        }
        
        // 标签匹配（只保留最长的，不重复）
        const foundTags = [];
        const lower = normalized.toLowerCase();
        
        for (const tag of this.tags) {
            const tagLower = tag.toLowerCase();
            if (lower.includes(tagLower)) {
                // 排除被更长的标签覆盖的
                let covered = false;
                for (const other of this.tags) {
                    if (other !== tag && lower.includes(other.toLowerCase())) {
                        const otherLower = other.toLowerCase();
                        if (otherLower.length > tagLower.length && otherLower.includes(tagLower)) {
                            covered = true;
                            break;
                        }
                    }
                }
                if (!covered) foundTags.push(tag);
            }
        }
        foundTags.forEach(t => result.蛋白标签.add(t));
        
        // 荧光蛋白匹配（排除已匹配的）
        const matchedNames = Array.from(result.蛋白标签).map(t => t.toLowerCase());
        for (const fp of this.fluorescent) {
            const fpLower = fp.toLowerCase();
            if (lower.includes(fpLower)) {
                const alreadyMatched = matchedNames.some(t => fpLower.includes(t) || t.includes(fpLower));
                if (!alreadyMatched) {
                    result.荧光蛋白.add(fp);
                }
            }
        }
        
        result.置信度 = Math.min(matches / 5, 1.0);
        return result;
    }
};

console.log('[RecognitionTrainingData] Optimized loaded');
